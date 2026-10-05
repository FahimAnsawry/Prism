import {
  ELEMENT_COLUMNS,
  saveElementsSchema,
  SOCKET_ID_HEADER,
  type BoardElement,
  type ElementChanges,
  type ElementOp,
} from "@prism/shared";
import express, { Router } from "express";
import type { Prisma } from "../db/generated/client.js";
import { prisma } from "../db/client.js";
import { notFound, parseBody } from "../errors.js";
import { broadcastOps } from "../realtime.js";
import { requireUser } from "../session.js";
import { BOARD_NOT_FOUND, liveBoardWhere, uuidParam } from "./board-access.js";

type ElementRow = Prisma.ElementGetPayload<object>;
type Props = Record<string, unknown>;

const COLUMNS = new Set<string>(ELEMENT_COLUMNS);

/** Splits a flat element (or a partial one) into table columns and `props` fields. */
function split(fields: Record<string, unknown>) {
  const columns: Record<string, unknown> = {};
  const props: Props = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (COLUMNS.has(key)) columns[key] = value;
    else props[key] = value;
  }
  return { columns, props };
}

/** `props` with `changes` applied; a null change removes the field. */
function mergeProps(current: unknown, changes: Props) {
  const merged: Props = { ...(current as Props) };
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return merged as Prisma.InputJsonObject;
}

/** Optional columns: absent on the client means null/false in the table. */
const columnDefaults = { groupId: null, locked: false, role: null };

export function toElement(row: ElementRow): BoardElement {
  const {
    boardId: _board,
    props,
    deletedAt: _deleted,
    createdAt: _c,
    updatedAt: _u,
    ...columns
  } = row;
  const element = { ...(props as Props), ...columns } as BoardElement;
  // Leave unset optional columns out instead of sending nulls.
  if (element.groupId === null) delete element.groupId;
  if (element.role === null) delete element.role;
  if (!element.locked) delete element.locked;
  return element;
}

/** The board if it's the user's and live; otherwise a 404. */
export async function ownedBoard(boardIdParam: string | string[] | undefined, ownerId: string) {
  const boardId = uuidParam(boardIdParam);
  const board = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...liveBoardWhere(ownerId) },
        select: { id: true, name: true, projectId: true },
      })
    : null;
  if (!board) throw notFound(BOARD_NOT_FOUND);
  return board;
}

type Existing = Pick<ElementRow, "id" | "version" | "deletedAt"> & { props: unknown };

/** The write for one op, or null when it lost to a newer version (or has nothing to change). */
function writeFor(
  boardId: string,
  op: ElementOp,
  existing: Existing | undefined,
  now: Date,
): Prisma.PrismaPromise<unknown> | null {
  const id = op.op === "create" ? op.element.id : op.id;
  const where = { boardId_id: { boardId, id } };

  switch (op.op) {
    case "create": {
      const { id: _id, version, ...fields } = op.element;
      const { columns, props } = split(fields);
      const data = {
        ...columnDefaults,
        ...columns,
        props: props as Prisma.InputJsonObject,
        version,
        deletedAt: null,
      } as Prisma.ElementUncheckedCreateInput;
      // An undo can bring back a deleted element under its old id: revive the tombstone.
      if (existing) {
        if (version <= existing.version) return null;
        return prisma.element.update({ where, data });
      }
      return prisma.element.create({ data: { ...data, boardId, id } });
    }

    case "update": {
      if (!existing || existing.deletedAt || op.version <= existing.version) return null;
      const { columns, props } = split(op.changes as ElementChanges as Record<string, unknown>);
      // Nullable columns accept null; `locked` is a plain boolean.
      if (columns["locked"] === null) columns["locked"] = false;
      return prisma.element.update({
        where,
        data: {
          ...columns,
          ...(Object.keys(props).length > 0 && { props: mergeProps(existing.props, props) }),
          version: op.version,
        } as Prisma.ElementUncheckedUpdateInput,
      });
    }

    case "delete": {
      if (!existing || existing.deletedAt || op.version <= existing.version) return null;
      return prisma.element.update({ where, data: { deletedAt: now, version: op.version } });
    }
  }
}

/**
 * Applies a batch of create/update/delete ops in one transaction. Each op carries the element's
 * next version; an op whose version isn't higher than the stored one is stale and skipped.
 * Returns the ops that were applied (for broadcasting) and the ids of the stale ones.
 */
export async function applyOps(board: { id: string; projectId: string | null }, ops: ElementOp[]) {
  const ids = [...new Set(ops.map((op) => (op.op === "create" ? op.element.id : op.id)))];
  const rows = await prisma.element.findMany({
    where: { boardId: board.id, id: { in: ids } },
    select: { id: true, version: true, deletedAt: true, props: true },
  });
  const existing = new Map<string, Existing>(rows.map((row) => [row.id, row]));

  const now = new Date();
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const applied: ElementOp[] = [];
  const stale: string[] = [];
  for (const op of ops) {
    const id = op.op === "create" ? op.element.id : op.id;
    const before = existing.get(id);
    const write = writeFor(board.id, op, before, now);
    if (!write) {
      stale.push(id);
      continue;
    }
    writes.push(write);
    applied.push(op);
    // Later ops in the same batch see this one's result.
    const version = op.op === "create" ? op.element.version : op.version;
    const props =
      op.op === "update"
        ? mergeProps(before?.props, split(op.changes as Record<string, unknown>).props)
        : op.op === "create"
          ? split(op.element as unknown as Record<string, unknown>).props
          : before?.props;
    existing.set(id, { id, version, deletedAt: op.op === "delete" ? now : null, props });
  }

  if (writes.length > 0) {
    await prisma.$transaction([
      ...writes,
      prisma.board.update({ where: { id: board.id }, data: { editedAt: now } }),
      ...(board.projectId
        ? [prisma.project.update({ where: { id: board.projectId }, data: { editedAt: now } })]
        : []),
    ]);
  }
  return { applied, stale };
}

// Mounted before the app-wide express.json(), so the save route can take a larger body. Each
// route checks the session itself: a router-level `use` would run for every /api request.
export const elementsRouter = Router();

/** The board's live elements, bottom layer first. */
elementsRouter.get("/boards/:boardId/elements", requireUser, async (req, res) => {
  const board = await ownedBoard(req.params.boardId, res.locals.userId);
  const rows = await prisma.element.findMany({
    where: { boardId: board.id, deletedAt: null },
    orderBy: { z: "asc" },
  });
  res.json({ elements: rows.map(toElement) });
});

/** Saves a batch of ops (see applyOps) and sends the applied ones to the board's other tabs. */
elementsRouter.post(
  "/boards/:boardId/elements",
  requireUser,
  // Freehand strokes and big batches outgrow express.json()'s 100 KB default.
  express.json({ limit: "8mb" }),
  async (req, res) => {
    const board = await ownedBoard(req.params.boardId, res.locals.userId);
    const { ops } = parseBody(saveElementsSchema, req.body);
    const { applied, stale } = await applyOps(board, ops);
    // The saving tab already has these; every other tab on the board gets them now.
    broadcastOps(board.id, applied, req.get(SOCKET_ID_HEADER) || undefined);
    res.json({ applied: applied.length, stale });
  },
);
