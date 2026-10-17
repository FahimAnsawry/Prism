import {
  EDITED_AT_HEADER,
  ELEMENT_COLUMNS,
  saveElementsSchema,
  SOCKET_ID_HEADER,
  type BoardElement,
  type ElementChanges,
  type ElementChangesReply,
  type ElementOp,
} from "@prism/shared";
import express, { Router } from "express";
import { Prisma } from "../db/generated/client.js";
import { prisma } from "../db/client.js";
import { badRequest, parseBody } from "../errors.js";
import { broadcastOps } from "../realtime.js";
import { requireUser } from "../session.js";
import { boardFor } from "./board-access.js";

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

type Existing = Pick<ElementRow, "id" | "version" | "deletedAt"> & { props: unknown };

type CreateOp = Extract<ElementOp, { op: "create" }>;

/** The row a create op writes. */
function createData(boardId: string, op: CreateOp): Prisma.ElementCreateManyInput {
  const { id, version, ...fields } = op.element;
  const { columns, props } = split(fields);
  return {
    ...columnDefaults,
    ...columns,
    props: props as Prisma.InputJsonObject,
    version,
    deletedAt: null,
    boardId,
    id,
  } as Prisma.ElementCreateManyInput;
}

/**
 * The write for one op, or null when it lost to a newer version (or has nothing to change).
 * Creates of new ids don't come here: applyOps inserts them all in one createMany.
 */
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
      // An undo can bring back a deleted element under its old id: revive the tombstone.
      if (!existing || op.element.version <= existing.version) return null;
      const { boardId: _board, id: _id, ...data } = createData(boardId, op);
      return prisma.element.update({ where, data });
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

/** An update op that changes table columns only (no `props`), written with others like it. */
type ColumnUpdate = { id: string; version: number; columns: Record<string, unknown> };

/**
 * The column update for `op`, or null when it isn't one: a create or delete, an update that
 * changes `props` (merged per element), or one that lost to a newer version (writeFor reports it).
 */
function columnUpdateFor(op: ElementOp, existing: Existing | undefined): ColumnUpdate | null {
  if (op.op !== "update" || !existing || existing.deletedAt || op.version <= existing.version) {
    return null;
  }
  const { columns, props } = split(op.changes as ElementChanges as Record<string, unknown>);
  if (Object.keys(props).length > 0) return null;
  // Nullable columns accept null; `locked` is a plain boolean.
  if (columns["locked"] === null) columns["locked"] = false;
  return { id: op.id, version: op.version, columns };
}

/** Each column's SQL type, for the VALUES list of a batched update. */
const COLUMN_TYPES: Record<string, string> = {
  type: '"ElementType"',
  x: "double precision",
  y: "double precision",
  width: "double precision",
  height: "double precision",
  rotation: "double precision",
  z: "double precision",
  stroke: "text",
  fill: "text",
  strokeWidth: "double precision",
  strokeStyle: '"StrokeStyle"',
  sketch: "boolean",
  opacity: "double precision",
  groupId: "text",
  locked: "boolean",
  role: "text",
  updatedBy: '"Author"',
};

/** Rows per batched UPDATE (well under Postgres's 65,535 parameters with every column set). */
const COLUMN_UPDATE_ROWS = 500;

/**
 * Column updates as `UPDATE … FROM (VALUES …)` statements, one per set of changed columns (a drag
 * of 100 elements is one statement instead of 100). Each row gets its op's version and
 * `updatedAt`, like an update through Prisma.
 */
function columnUpdateStatements(boardId: string, updates: ColumnUpdate[], now: Date) {
  const groups = new Map<string, ColumnUpdate[]>();
  for (const update of updates) {
    const key = Object.keys(update.columns).sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), update]);
  }
  // Prisma keeps DateTime as UTC in a column without a time zone.
  const updatedAt = Prisma.sql`(${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const statements: Prisma.PrismaPromise<number>[] = [];
  for (const [key, group] of groups) {
    const names = key ? key.split(",") : [];
    for (const name of names) {
      if (!COLUMN_TYPES[name]) throw new Error(`No SQL type for the element column ${name}`);
    }
    const set = Prisma.join([
      ...names.map((name) => Prisma.raw(`"${name}" = v."${name}"`)),
      Prisma.raw(`"version" = v."version"`),
      Prisma.sql`"updatedAt" = ${updatedAt}`,
    ]);
    const columns = Prisma.raw(["id", "version", ...names].map((name) => `"${name}"`).join(", "));
    for (let i = 0; i < group.length; i += COLUMN_UPDATE_ROWS) {
      const rows = group
        .slice(i, i + COLUMN_UPDATE_ROWS)
        .map(
          (update) =>
            Prisma.sql`(${Prisma.join([
              Prisma.sql`${update.id}::text`,
              Prisma.sql`${update.version}::integer`,
              ...names.map(
                (name) => Prisma.sql`${update.columns[name]}::${Prisma.raw(COLUMN_TYPES[name]!)}`,
              ),
            ])})`,
        );
      statements.push(
        prisma.$executeRaw`UPDATE "element" AS e SET ${set} FROM (VALUES ${Prisma.join(rows)}) AS v(${columns}) WHERE e."boardId" = ${boardId} AND e."id" = v."id"`,
      );
    }
  }
  return statements;
}

/**
 * A batch transaction sends its queries one after another, so its time grows with the number of
 * queries (~50 ms each to Neon). Prisma's default of 5 s fails a save of ~100 updated elements
 * that each change `props`; column-only updates go in a few statements (columnUpdateStatements).
 */
const SAVE_TIMEOUT_MS = 30_000;

/**
 * Applies a batch of create/update/delete ops in one transaction. Each op carries the element's
 * next version; an op whose version isn't higher than the stored one is stale and skipped.
 * New elements go in with one createMany (a screen from create_screen is hundreds of them), and
 * updates that change only columns in a few batched statements. Ops on the same element keep
 * their order. Returns the ops that were applied (for broadcasting) and the ids of the stale ones.
 */
export async function applyOps(board: { id: string; projectId: string | null }, ops: ElementOp[]) {
  const ids = [...new Set(ops.map((op) => (op.op === "create" ? op.element.id : op.id)))];
  const rows = await prisma.element.findMany({
    where: { boardId: board.id, id: { in: ids } },
    select: { id: true, version: true, deletedAt: true, props: true },
  });
  const existing = new Map<string, Existing>(rows.map((row) => [row.id, row]));

  // An element with one op in the batch can be written in any order with the others; one with
  // several gets its writes one by one, in order.
  const opsPerId = new Map<string, number>();
  for (const op of ops) {
    const id = op.op === "create" ? op.element.id : op.id;
    opsPerId.set(id, (opsPerId.get(id) ?? 0) + 1);
  }

  const now = new Date();
  // New rows depend on nothing else in the batch, so they're inserted first, in one query.
  const inserts: Prisma.ElementCreateManyInput[] = [];
  const columnUpdates: ColumnUpdate[] = [];
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const applied: ElementOp[] = [];
  const stale: string[] = [];
  for (const op of ops) {
    const id = op.op === "create" ? op.element.id : op.id;
    const before = existing.get(id);
    const columnUpdate = opsPerId.get(id) === 1 ? columnUpdateFor(op, before) : null;
    if (op.op === "create" && !before) {
      inserts.push(createData(board.id, op));
    } else if (columnUpdate) {
      columnUpdates.push(columnUpdate);
    } else {
      const write = writeFor(board.id, op, before, now);
      if (!write) {
        stale.push(id);
        continue;
      }
      writes.push(write);
    }
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

  if (inserts.length > 0 || columnUpdates.length > 0 || writes.length > 0) {
    await prisma.$transaction(
      [
        ...(inserts.length > 0 ? [prisma.element.createMany({ data: inserts })] : []),
        ...columnUpdateStatements(board.id, columnUpdates, now),
        ...writes,
        prisma.board.update({ where: { id: board.id }, data: { editedAt: now } }),
        ...(board.projectId
          ? [prisma.project.update({ where: { id: board.projectId }, data: { editedAt: now } })]
          : []),
      ],
      { timeout: SAVE_TIMEOUT_MS },
    );
    replies.delete(board.id);
  }
  return { applied, stale };
}

/**
 * Each board's last element reply (its JSON), with the board's `editedAt` it was read at. Every
 * element write goes through applyOps, which moves `editedAt` in the same transaction, so a reply
 * is reused only while the board's `editedAt` still matches. That holds across server processes
 * too; this process also drops a board's reply as soon as it writes. A big board takes ~0.5 s to
 * read from the database (2 MB of rows), and about nothing from here.
 */
const replies = new Map<string, { editedAt: number; body: string }>();
let repliesSize = 0;
/** Characters of JSON kept in all; the boards opened longest ago go first. */
const REPLIES_MAX_SIZE = 64 * 1024 * 1024;

function rememberReply(boardId: string, editedAt: number, body: string) {
  const old = replies.get(boardId);
  if (old) repliesSize -= old.body.length;
  replies.delete(boardId);
  if (body.length > REPLIES_MAX_SIZE / 4) return;
  replies.set(boardId, { editedAt, body });
  repliesSize += body.length;
  for (const [id, reply] of replies) {
    if (repliesSize <= REPLIES_MAX_SIZE) break;
    replies.delete(id);
    repliesSize -= reply.body.length;
  }
}

/** The board's remembered reply if it's still current, moved to the newest place. */
function currentReply(boardId: string, editedAt: number) {
  const reply = replies.get(boardId);
  if (!reply) return null;
  replies.delete(boardId);
  if (reply.editedAt !== editedAt) {
    repliesSize -= reply.body.length;
    return null;
  }
  replies.set(boardId, reply);
  return reply.body;
}

/**
 * The board's live elements as a reply body (JSON `{ elements }`), from the remembered reply while
 * it's current. `editedAt` is the board's, read before calling: read after the rows, a save in
 * between could leave old rows under the new `editedAt`.
 */
export async function elementsReplyBody(boardId: string, editedAt: number) {
  let body = currentReply(boardId, editedAt);
  if (!body) {
    const rows = await prisma.element.findMany({
      where: { boardId, deletedAt: null },
      orderBy: { z: "asc" },
    });
    body = JSON.stringify({ elements: rows.map(toElement) });
    rememberReply(boardId, editedAt, body);
  }
  return body;
}

/**
 * How far before `since` changes are looked for. A save stamps its rows with the time it started,
 * and one that started before the board's `editedAt` was read can commit after it (a save takes
 * up to SAVE_TIMEOUT_MS), so its rows can be a little older than `since`. Sending an element the
 * tab already has costs nothing: the tab keeps only versions newer than its own.
 */
const CHANGES_MARGIN_MS = 2 * 60_000;

/**
 * Deleted elements are kept as tombstones for this long (see purgeTombstones), so changes can be
 * told only from a `since` well inside it. An older one gets every live element instead.
 */
export const TOMBSTONE_KEEP_MS = 30 * 24 * 60 * 60_000;
const CHANGES_MAX_AGE_MS = TOMBSTONE_KEEP_MS - 24 * 60 * 60_000;

/** The `since` query parameter: a time in ms, or undefined when absent. */
export function sinceParam(value: unknown) {
  if (value === undefined) return undefined;
  const since = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(since) || since < 0) throw badRequest("`since` must be a time in ms.");
  return since;
}

/**
 * What changed on the board since its `editedAt` was `since` (see ElementChangesReply). `editedAt`
 * is the board's, read before calling, for the same reason as in elementsReplyBody.
 */
export async function elementChanges(
  boardId: string,
  editedAt: number,
  since: number,
): Promise<ElementChangesReply> {
  if (since < Date.now() - CHANGES_MAX_AGE_MS) {
    const { elements } = JSON.parse(await elementsReplyBody(boardId, editedAt)) as {
      elements: BoardElement[];
    };
    return { full: true, editedAt, elements, deleted: [] };
  }
  const rows = await prisma.element.findMany({
    where: { boardId, updatedAt: { gte: new Date(since - CHANGES_MARGIN_MS) } },
    orderBy: { z: "asc" },
  });
  const elements: BoardElement[] = [];
  const deleted: ElementChangesReply["deleted"] = [];
  for (const row of rows) {
    if (row.deletedAt) deleted.push({ id: row.id, version: row.version });
    else elements.push(toElement(row));
  }
  return { full: false, editedAt, elements, deleted };
}

// Mounted before the app-wide express.json(), so the save route can take a larger body. Each
// route checks the session itself: a router-level `use` would run for every /api request.
export const elementsRouter = Router();

/**
 * The board's live elements, bottom layer first, with the board's `editedAt` they were read at
 * in a header. With `?since=<editedAt>`, only what changed since then (ElementChangesReply).
 */
elementsRouter.get("/boards/:boardId/elements", requireUser, async (req, res) => {
  const since = sinceParam(req.query["since"]);
  // The board is read first: its `editedAt` says whether the remembered reply is still current.
  const board = await boardFor(req.params.boardId, res.locals.userId, "view");
  const editedAt = board.editedAt.getTime();
  if (since !== undefined) {
    res.json(await elementChanges(board.id, editedAt, since));
    return;
  }
  const body = await elementsReplyBody(board.id, editedAt);
  res.set(EDITED_AT_HEADER, String(editedAt)).type("json").send(body);
});

/** Saves a batch of ops (see applyOps) and sends the applied ones to the board's other tabs. */
elementsRouter.post(
  "/boards/:boardId/elements",
  requireUser,
  // Freehand strokes and big batches outgrow express.json()'s 100 KB default.
  express.json({ limit: "8mb" }),
  async (req, res) => {
    // Viewers get a 403 here: only owners and editors change a board.
    const board = await boardFor(req.params.boardId, res.locals.userId, "edit");
    const { ops } = parseBody(saveElementsSchema, req.body);
    const { applied, stale } = await applyOps(board, ops);
    // The saving tab already has these; every other tab on the board gets them now.
    broadcastOps(board.id, applied, req.get(SOCKET_ID_HEADER) || undefined);
    res.json({ applied: applied.length, stale });
  },
);
