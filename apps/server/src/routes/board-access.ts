import { randomBytes } from "node:crypto";
import type { Access } from "@prism/shared";
import { z } from "zod";
import type { Prisma } from "../db/generated/client.js";
import { prisma } from "../db/client.js";
import { HttpError, notFound } from "../errors.js";

// Who may do what with a board or a project. The owner does everything; a team member is an
// editor (view and edit content) or a viewer (read-only); a member of a project has that role
// on every board in it. Sharing, moving, deleting and the public link are the owner's alone.

export const BOARD_NOT_FOUND = "Board not found.";
export const PROJECT_NOT_FOUND = "That project no longer exists.";

/** What a request needs: to read, or to change content. */
export type Need = "view" | "edit";

/** A route param that must be a UUID; anything else can't match a row, so it reads as "not found". */
export function uuidParam(value: string | string[] | undefined) {
  const result = z.uuid().safeParse(value);
  return result.success ? result.data : undefined;
}

/** A new secret for a public link or an invite. */
export const newShareToken = () => randomBytes(24).toString("base64url");

/** Boards and projects that aren't in the trash (a board in an archived project is hidden with it). */
export const liveBoard = {
  archivedAt: null,
  OR: [{ projectId: null }, { project: { archivedAt: null } }],
} satisfies Prisma.BoardWhereInput;

/** The user's own live boards. */
export const liveBoardWhere = (ownerId: string) => ({ ownerId, ...liveBoard });

/** The user's own live projects. */
export const liveProjectWhere = (ownerId: string) => ({ ownerId, archivedAt: null });

const roleFor = (need: Need) => (need === "edit" ? { role: "editor" as const } : {});

/** Live boards the user may see (`need` "view") or edit: their own and ones shared with them. */
export function accessibleBoardWhere(userId: string, need: Need = "view") {
  const member = { some: { userId, ...roleFor(need) } };
  return {
    ...liveBoard,
    AND: [
      {
        OR: [{ ownerId: userId }, { members: member }, { project: { members: member } }],
      },
    ],
  } satisfies Prisma.BoardWhereInput;
}

/** Live boards shared with the user (not their own). */
export function sharedBoardWhere(userId: string) {
  const member = { some: { userId } };
  return {
    ...liveBoard,
    ownerId: { not: userId },
    AND: [{ OR: [{ members: member }, { project: { members: member } }] }],
  } satisfies Prisma.BoardWhereInput;
}

/** Live projects the user may see or edit: their own and ones shared with them. */
export function accessibleProjectWhere(userId: string, need: Need = "view") {
  return {
    archivedAt: null,
    OR: [{ ownerId: userId }, { members: { some: { userId, ...roleFor(need) } } }],
  } satisfies Prisma.ProjectWhereInput;
}

/** Live projects shared with the user (not their own). */
export const sharedProjectWhere = (userId: string) =>
  ({
    archivedAt: null,
    ownerId: { not: userId },
    members: { some: { userId } },
  }) satisfies Prisma.ProjectWhereInput;

/** The fields accessOf reads, for a board's select. */
export const boardAccessSelect = (userId: string) =>
  ({
    ownerId: true,
    members: { where: { userId }, select: { role: true } },
    project: { select: { members: { where: { userId }, select: { role: true } } } },
  }) as const;

type AccessRow = {
  ownerId: string;
  members: { role: "editor" | "viewer" }[];
  project?: { members: { role: "editor" | "viewer" }[] } | null;
};

/** The user's access from a row selected with boardAccessSelect (or a project's ownerId + members). */
export function accessOf(row: AccessRow, userId: string): Access {
  if (row.ownerId === userId) return "owner";
  const roles = [...row.members, ...(row.project?.members ?? [])].map((m) => m.role);
  return roles.includes("editor") ? "editor" : "viewer";
}

const readOnly = (kind: "board" | "project") =>
  new HttpError(
    403,
    `This ${kind} is shared with you as a viewer, so you can look at it but not change it.`,
  );

/**
 * The board if the user may view it (or edit it, for `need` "edit"), with their access. A board
 * they can't see at all is a 404; one they can only view, asked to edit, is a 403.
 */
export async function boardFor(
  boardIdParam: string | string[] | undefined,
  userId: string,
  need: Need,
) {
  const boardId = uuidParam(boardIdParam);
  const row = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...accessibleBoardWhere(userId) },
        select: { id: true, name: true, projectId: true, ...boardAccessSelect(userId) },
      })
    : null;
  if (!row) throw notFound(BOARD_NOT_FOUND);
  const access = accessOf(row, userId);
  if (need === "edit" && access === "viewer") throw readOnly("board");
  return { id: row.id, name: row.name, projectId: row.projectId, ownerId: row.ownerId, access };
}

/**
 * The project if the user may view it (or edit it). Viewing also covers someone a board of the
 * project is shared with: its theme and components draw that board.
 */
export async function projectFor(
  projectIdParam: string | string[] | undefined,
  userId: string,
  need: Need,
) {
  const projectId = uuidParam(projectIdParam);
  const row = projectId
    ? await prisma.project.findFirst({
        where: {
          id: projectId,
          archivedAt: null,
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
            ...(need === "view"
              ? [{ boards: { some: { archivedAt: null, members: { some: { userId } } } } }]
              : []),
          ],
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          members: { where: { userId }, select: { role: true } },
        },
      })
    : null;
  if (!row) throw notFound(PROJECT_NOT_FOUND);
  const access = accessOf(row, userId);
  if (need === "edit" && access === "viewer") throw readOnly("project");
  return { id: row.id, name: row.name, ownerId: row.ownerId, access };
}

// ── Public links ───────────────────────────────────────────────────────────

/** A string that could be a share token; anything else can't match one. */
export const shareTokenParam = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value) ? value : undefined;

/**
 * The live board a public link shows, or null: the link's own board, or a board in the link's
 * project. Nobody needs to be signed in.
 */
export async function boardForShareToken(tokenParam: unknown, boardIdParam: unknown) {
  const token = shareTokenParam(tokenParam);
  const boardId = typeof boardIdParam === "string" ? uuidParam(boardIdParam) : undefined;
  if (!token || !boardId) return null;
  return prisma.board.findFirst({
    where: {
      id: boardId,
      ...liveBoard,
      AND: [{ OR: [{ shareToken: token }, { project: { shareToken: token } }] }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      editedAt: true,
      project: { select: { name: true } },
      owner: { select: { name: true } },
      _count: { select: { elements: { where: { deletedAt: null } } } },
    },
  });
}
