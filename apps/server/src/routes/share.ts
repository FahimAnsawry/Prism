import {
  inviteMemberSchema,
  shareLinkSchema,
  updateMemberSchema,
  type InviteInfo,
  type InviteResult,
  type PublicBoard,
  type PublicBoardData,
  type PublicShare,
  type ShareKind,
  type ShareSettings,
} from "@prism/shared";
import { Router, type Response } from "express";
import { prisma } from "../db/client.js";
import { badRequest, HttpError, notFound, parseBody } from "../errors.js";
import { acceptInvite } from "../invites.js";
import { notifyAccessChanged, revokeBoardTabs } from "../realtime.js";
import { requireUser } from "../session.js";
import { toElement } from "./elements.js";
import {
  accessibleBoardWhere,
  BOARD_NOT_FOUND,
  boardFor,
  boardForShareToken,
  liveBoard,
  liveBoardWhere,
  liveProjectWhere,
  newShareToken,
  PROJECT_NOT_FOUND,
  projectFor,
  shareTokenParam,
  uuidParam,
} from "./board-access.js";

// Sharing a board or a project: the owner's Share dialog (members, invites, the public link),
// invite links, and the public view-only pages, which need no account.

const clientUrl = () => process.env["CLIENT_URL"] ?? "";
const linkUrl = (token: string) => new URL(`/s/${token}`, clientUrl()).toString();
const inviteUrl = (token: string) => new URL(`/invite/${token}`, clientUrl()).toString();

const LINK_GONE = "This link doesn't work anymore. Ask the person who shared it for a new one.";
const INVITE_GONE = "This invite was cancelled or already used. Ask for a new one.";

const person = { select: { id: true, name: true, email: true, image: true } } as const;

// Every route checks the session itself where it needs one: the public ones must work without.
export const shareRouter = Router();

// ── The owner's Share dialog ───────────────────────────────────────────────

/** The item if the user owns it; a member gets a 403, anyone else a 404. */
async function ownedTarget(kind: ShareKind, idParam: string | undefined, userId: string) {
  const id = uuidParam(idParam);
  if (kind === "board") {
    const board = id
      ? await prisma.board.findFirst({
          where: { id, ...liveBoardWhere(userId) },
          select: { id: true },
        })
      : null;
    if (board) return board.id;
    await boardFor(idParam, userId, "view");
  } else {
    const project = id
      ? await prisma.project.findFirst({
          where: { id, ...liveProjectWhere(userId) },
          select: { id: true },
        })
      : null;
    if (project) return project.id;
    await projectFor(idParam, userId, "view");
  }
  throw new HttpError(403, `Only the ${kind}'s owner can change who it's shared with.`);
}

async function loadSettings(kind: ShareKind, id: string): Promise<ShareSettings> {
  const select = {
    id: true,
    name: true,
    shareToken: true,
    owner: person,
    members: { orderBy: { createdAt: "asc" }, select: { role: true, user: person } },
    invites: {
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true, token: true, createdAt: true },
    },
  } as const;
  const row =
    kind === "board"
      ? await prisma.board.findUniqueOrThrow({ where: { id }, select })
      : await prisma.project.findUniqueOrThrow({ where: { id }, select });
  const { owner } = row;
  return {
    kind,
    id: row.id,
    name: row.name,
    owner: { name: owner.name, email: owner.email, image: owner.image },
    members: row.members.map(({ role, user }) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role,
    })),
    invites: row.invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      url: inviteUrl(invite.token),
      createdAt: invite.createdAt.toISOString(),
    })),
    link: row.shareToken ? linkUrl(row.shareToken) : null,
  };
}

/** The boards a share of this item covers: the board, or every board in the project. */
async function boardsOf(kind: ShareKind, id: string) {
  if (kind === "board") return [id];
  const boards = await prisma.board.findMany({ where: { projectId: id }, select: { id: true } });
  return boards.map((b) => b.id);
}

/** Of these boards, the ones the user can no longer see (after leaving or being removed). */
async function boardsLost(boardIds: string[], userId: string) {
  const still = await prisma.board.findMany({
    where: { id: { in: boardIds }, ...accessibleBoardWhere(userId) },
    select: { id: true },
  });
  const kept = new Set(still.map((b) => b.id));
  return boardIds.filter((id) => !kept.has(id));
}

const noStore = (res: Response) => res.set("Cache-Control", "no-store");

/** A route param by name (routes built from a template string don't type their params). */
const param = (params: Record<string, string | string[] | undefined>, name: string) => {
  const value = params[name];
  return typeof value === "string" ? value : "";
};

for (const kind of ["board", "project"] as const) {
  const base = `/${kind}s/:id/share`;

  shareRouter.get(base, requireUser, async (req, res) => {
    const id = await ownedTarget(kind, param(req.params, "id"), res.locals.userId);
    res.json(await loadSettings(kind, id));
  });

  /** Adds someone with a Prism account right away; anyone else gets an invite link. */
  shareRouter.post(`${base}/members`, requireUser, async (req, res) => {
    const userId = res.locals.userId;
    const id = await ownedTarget(kind, param(req.params, "id"), userId);
    const { email, role } = parseBody(inviteMemberSchema, req.body);
    const target = kind === "board" ? { boardId: id } : { projectId: id };

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (user?.id === userId) throw badRequest("That's your own email: you already own this.");

    let result: Pick<InviteResult, "status" | "url">;
    if (user) {
      if (kind === "board") {
        await prisma.boardMember.upsert({
          where: { boardId_userId: { boardId: id, userId: user.id } },
          create: { boardId: id, userId: user.id, role, invitedById: userId },
          update: { role },
        });
      } else {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: id, userId: user.id } },
          create: { projectId: id, userId: user.id, role, invitedById: userId },
          update: { role },
        });
      }
      await prisma.shareInvite.deleteMany({ where: { ...target, email } });
      notifyAccessChanged(await boardsOf(kind, id), user.id);
      result = { status: "added" };
    } else {
      const existing = await prisma.shareInvite.findFirst({ where: { ...target, email } });
      const invite = existing
        ? await prisma.shareInvite.update({ where: { id: existing.id }, data: { role } })
        : await prisma.shareInvite.create({
            data: { ...target, email, role, token: newShareToken(), invitedById: userId },
          });
      const url = inviteUrl(invite.token);
      // Until an email provider is attached, the owner sends the link (the dialog shows it).
      console.info(`[share] Invite for ${email} to a ${kind} (${role}):\n  ${url}`);
      result = { status: "invited", url };
    }
    res.status(201).json({ ...result, settings: await loadSettings(kind, id) });
  });

  shareRouter.patch(`${base}/members/:userId`, requireUser, async (req, res) => {
    const id = await ownedTarget(kind, param(req.params, "id"), res.locals.userId);
    const { role } = parseBody(updateMemberSchema, req.body);
    const memberId = param(req.params, "userId");
    const { count } =
      kind === "board"
        ? await prisma.boardMember.updateMany({
            where: { boardId: id, userId: memberId },
            data: { role },
          })
        : await prisma.projectMember.updateMany({
            where: { projectId: id, userId: memberId },
            data: { role },
          });
    if (count === 0) throw notFound("That person isn't a member anymore.");
    // Their open tabs reload what they may do.
    notifyAccessChanged(await boardsOf(kind, id), memberId);
    res.json(await loadSettings(kind, id));
  });

  /** The owner removes a member, or a member leaves. */
  shareRouter.delete(`${base}/members/:userId`, requireUser, async (req, res) => {
    const userId = res.locals.userId;
    const memberId = param(req.params, "userId");
    const leaving = memberId === userId;
    const id = leaving
      ? uuidParam(param(req.params, "id"))
      : await ownedTarget(kind, param(req.params, "id"), userId);
    if (!id) throw notFound(kind === "board" ? BOARD_NOT_FOUND : PROJECT_NOT_FOUND);

    const { count } =
      kind === "board"
        ? await prisma.boardMember.deleteMany({ where: { boardId: id, userId: memberId } })
        : await prisma.projectMember.deleteMany({ where: { projectId: id, userId: memberId } });
    if (count === 0) throw notFound("That person isn't a member anymore.");

    // Access ends now: their open tabs leave the boards they can no longer see.
    const boards = await boardsOf(kind, id);
    revokeBoardTabs(await boardsLost(boards, memberId), { userId: memberId });
    notifyAccessChanged(boards, memberId);
    if (leaving) {
      res.json({ id });
      return;
    }
    res.json(await loadSettings(kind, id));
  });

  shareRouter.delete(`${base}/invites/:inviteId`, requireUser, async (req, res) => {
    const id = await ownedTarget(kind, param(req.params, "id"), res.locals.userId);
    const inviteId = uuidParam(param(req.params, "inviteId"));
    const target = kind === "board" ? { boardId: id } : { projectId: id };
    if (inviteId) await prisma.shareInvite.deleteMany({ where: { id: inviteId, ...target } });
    res.json(await loadSettings(kind, id));
  });

  /** Turns the public link on, or replaces it so the old one stops working. */
  shareRouter.post(`${base}/link`, requireUser, async (req, res) => {
    const id = await ownedTarget(kind, param(req.params, "id"), res.locals.userId);
    const { action } = parseBody(shareLinkSchema, req.body);
    const old = await currentToken(kind, id);
    if (action === "regenerate" || !old) {
      await setToken(kind, id, newShareToken());
      if (old) revokeBoardTabs(await boardsOf(kind, id), { shareToken: old });
    }
    res.json(await loadSettings(kind, id));
  });

  /** Turns the public link off: open link pages lose the board right away. */
  shareRouter.delete(`${base}/link`, requireUser, async (req, res) => {
    const id = await ownedTarget(kind, param(req.params, "id"), res.locals.userId);
    const old = await currentToken(kind, id);
    if (old) {
      await setToken(kind, id, null);
      revokeBoardTabs(await boardsOf(kind, id), { shareToken: old });
    }
    res.json(await loadSettings(kind, id));
  });
}

async function currentToken(kind: ShareKind, id: string) {
  const row =
    kind === "board"
      ? await prisma.board.findUnique({ where: { id }, select: { shareToken: true } })
      : await prisma.project.findUnique({ where: { id }, select: { shareToken: true } });
  return row?.shareToken ?? null;
}

async function setToken(kind: ShareKind, id: string, shareToken: string | null) {
  if (kind === "board") await prisma.board.update({ where: { id }, data: { shareToken } });
  else await prisma.project.update({ where: { id }, data: { shareToken } });
}

// ── Invite links ───────────────────────────────────────────────────────────

const inviteSelect = {
  id: true,
  email: true,
  role: true,
  boardId: true,
  projectId: true,
  invitedById: true,
  invitedBy: { select: { name: true } },
  board: { select: { name: true, archivedAt: true } },
  project: { select: { name: true, archivedAt: true } },
} as const;

async function findInvite(tokenParam: unknown) {
  const token = shareTokenParam(tokenParam);
  const invite = token
    ? await prisma.shareInvite.findUnique({ where: { token }, select: inviteSelect })
    : null;
  const item = invite?.board ?? invite?.project;
  if (!invite || !item || item.archivedAt) throw notFound(INVITE_GONE);
  return { invite, name: item.name, kind: (invite.boardId ? "board" : "project") as ShareKind };
}

/** What an invite is for, shown before signing in. */
shareRouter.get("/invites/:token", async (req, res) => {
  const { invite, name, kind } = await findInvite(req.params.token);
  noStore(res);
  res.json({
    kind,
    name,
    role: invite.role,
    email: invite.email,
    invitedBy: invite.invitedBy.name,
  } satisfies InviteInfo);
});

/** Accepts an invite: the signed-in user must have the email it was sent to. */
shareRouter.post("/invites/:token/accept", requireUser, async (req, res) => {
  const { invite, kind } = await findInvite(req.params.token);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: res.locals.userId },
    select: { id: true, email: true },
  });
  if (user.email.toLowerCase() !== invite.email) {
    throw new HttpError(
      403,
      `This invite is for ${invite.email}. Sign in with that email to accept it.`,
    );
  }
  await acceptInvite(user.id, invite);
  res.json({ kind, id: invite.boardId ?? invite.projectId });
});

// ── Public links (no account) ──────────────────────────────────────────────

const publicBoardSelect = {
  id: true,
  name: true,
  description: true,
  editedAt: true,
  _count: { select: { elements: { where: { deletedAt: null } } } },
} as const;

function toPublicBoard(row: {
  id: string;
  name: string;
  description: string | null;
  editedAt: Date;
  _count: { elements: number };
}): PublicBoard {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row._count.elements,
    editedAt: row.editedAt.toISOString(),
  };
}

/** What a public link opens: a board, or a project and its boards. */
shareRouter.get("/share/:token", async (req, res) => {
  const token = shareTokenParam(req.params.token);
  if (!token) throw notFound(LINK_GONE);
  noStore(res);
  const board = await prisma.board.findFirst({
    where: { shareToken: token, ...liveBoard },
    select: { ...publicBoardSelect, owner: { select: { name: true } } },
  });
  if (board) {
    res.json({
      kind: "board",
      ownerName: board.owner.name,
      board: toPublicBoard(board),
    } satisfies PublicShare);
    return;
  }
  const project = await prisma.project.findFirst({
    where: { shareToken: token, archivedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      owner: { select: { name: true } },
      boards: {
        where: { archivedAt: null },
        orderBy: { editedAt: "desc" },
        select: publicBoardSelect,
      },
    },
  });
  if (!project) throw notFound(LINK_GONE);
  res.json({
    kind: "project",
    ownerName: project.owner.name,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      boards: project.boards.map(toPublicBoard),
    },
  } satisfies PublicShare);
});

/** One board behind a public link, with its elements. */
shareRouter.get("/share/:token/boards/:boardId", async (req, res) => {
  const board = await boardForShareToken(req.params.token, req.params.boardId);
  if (!board) throw notFound(LINK_GONE);
  const rows = await prisma.element.findMany({
    where: { boardId: board.id, deletedAt: null },
    orderBy: { z: "asc" },
  });
  noStore(res);
  res.json({
    board: toPublicBoard(board),
    projectName: board.project?.name ?? null,
    elements: rows.map(toElement),
  } satisfies PublicBoardData);
});
