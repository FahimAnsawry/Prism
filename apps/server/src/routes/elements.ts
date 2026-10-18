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
import { badRequest, HttpError, parseBody } from "../errors.js";
import { LIMITS, limitPerUser } from "../rate-limit.js";
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

/** What applyOps reads of an element first; `props` only for one with several ops in the batch. */
type Existing = Pick<ElementRow, "id" | "version" | "deletedAt"> & { props?: unknown };

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
 * Creates of new ids don't come here (applyOps inserts them all in one createMany), and neither do
 * updates of an element with one op in the batch (batched by updateStatements).
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

/** An update op, written with others like it in one statement (updateStatements). */
type BatchedUpdate = {
  id: string;
  version: number;
  columns: Record<string, unknown>;
  /** `props` fields to set, and ones to remove (changed to null); null when it changes none. */
  props: { set: Props; remove: string[] } | null;
};

/**
 * The batched update for `op`, or null when it isn't one: a create or delete, or an update that
 * lost to a newer version (writeFor reports it).
 */
function batchedUpdateFor(op: ElementOp, existing: Existing | undefined): BatchedUpdate | null {
  if (op.op !== "update" || !existing || existing.deletedAt || op.version <= existing.version) {
    return null;
  }
  const { columns, props } = split(op.changes as ElementChanges as Record<string, unknown>);
  // Nullable columns accept null; `locked` is a plain boolean.
  if (columns["locked"] === null) columns["locked"] = false;
  const changed = Object.entries(props);
  return {
    id: op.id,
    version: op.version,
    columns,
    props:
      changed.length > 0
        ? {
            set: Object.fromEntries(changed.filter(([, value]) => value !== null)),
            remove: changed.filter(([, value]) => value === null).map(([key]) => key),
          }
        : null,
  };
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
const UPDATE_ROWS = 500;

/** `now` as SQL: Prisma keeps DateTime as UTC in a column without a time zone. */
const utc = (now: Date) => Prisma.sql`(${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/**
 * Updates as `UPDATE … FROM (VALUES …)` statements, one per set of changed columns and whether
 * `props` changes (a drag or a restyle of 100 elements is one statement instead of 100). `props`
 * is merged in SQL the way mergeProps does: `set` over the stored fields, then `remove` dropped.
 * Each row gets its op's version and `updatedAt`, like an update through Prisma.
 */
function updateStatements(boardId: string, updates: BatchedUpdate[], now: Date) {
  const groups = new Map<string, BatchedUpdate[]>();
  for (const update of updates) {
    const key = `${Object.keys(update.columns).sort().join(",")};${update.props ? "props" : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), update]);
  }
  const updatedAt = utc(now);
  const statements: Prisma.PrismaPromise<number>[] = [];
  for (const group of groups.values()) {
    const names = Object.keys(group[0]!.columns).sort();
    const withProps = group[0]!.props !== null;
    for (const name of names) {
      if (!COLUMN_TYPES[name]) throw new Error(`No SQL type for the element column ${name}`);
    }
    const set = Prisma.join([
      ...names.map((name) => Prisma.raw(`"${name}" = v."${name}"`)),
      ...(withProps ? [Prisma.raw(`"props" = (e."props" || v."set") - v."remove"`)] : []),
      Prisma.raw(`"version" = v."version"`),
      Prisma.sql`"updatedAt" = ${updatedAt}`,
    ]);
    const columns = Prisma.raw(
      ["id", "version", ...names, ...(withProps ? ["set", "remove"] : [])]
        .map((name) => `"${name}"`)
        .join(", "),
    );
    for (let i = 0; i < group.length; i += UPDATE_ROWS) {
      const rows = group
        .slice(i, i + UPDATE_ROWS)
        .map(
          (update) =>
            Prisma.sql`(${Prisma.join([
              Prisma.sql`${update.id}::text`,
              Prisma.sql`${update.version}::integer`,
              ...names.map(
                (name) => Prisma.sql`${update.columns[name]}::${Prisma.raw(COLUMN_TYPES[name]!)}`,
              ),
              ...(update.props
                ? [
                    Prisma.sql`${JSON.stringify(update.props.set)}::jsonb`,
                    Prisma.sql`${update.props.remove}::text[]`,
                  ]
                : []),
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
 * Marks the board and its project (if any) as edited, in one statement, and adds `added` (less
 * than 0 for removed ones) to the board's count of live elements.
 */
function touchStatement(boardId: string, now: Date, added: number) {
  const editedAt = utc(now);
  return prisma.$executeRaw`
    WITH b AS (
      UPDATE "board"
      SET "editedAt" = ${editedAt}, "updatedAt" = ${editedAt},
        "elementCount" = "elementCount" + ${added}::integer
      WHERE "id" = ${boardId}
      RETURNING "projectId"
    )
    UPDATE "project" AS p SET "editedAt" = ${editedAt}, "updatedAt" = ${editedAt}
    FROM b WHERE p."id" = b."projectId"`;
}

/**
 * A batch transaction sends its queries one after another, so its time grows with the number of
 * queries (~50 ms each to Neon). Prisma's default of 5 s fails a save of ~100 elements written one
 * by one (deletes, revived elements, several ops on one element); updates go in a few batched
 * statements (updateStatements).
 */
const SAVE_TIMEOUT_MS = 30_000;

/** Live elements one board may hold, so one user can't fill the database. */
export const BOARD_ELEMENTS_MAX = 25_000;

/**
 * Applies a batch of create/update/delete ops in one transaction. Each op carries the element's
 * next version; an op whose version isn't higher than the stored one is stale and skipped.
 * New elements go in with one createMany (a screen from create_screen is hundreds of them), and
 * updates in a few batched statements. Ops on the same element keep their order. The board's
 * elementCount moves with the live elements. Returns the ops that were applied (for broadcasting)
 * and the ids of the stale ones.
 */
export async function applyOps(board: { id: string }, ops: ElementOp[]) {
  const ids = [...new Set(ops.map((op) => (op.op === "create" ? op.element.id : op.id)))];

  // An element with one op in the batch can be written in any order with the others; one with
  // several gets its writes one by one, in order, with its `props` merged here. Only those
  // elements' props are read: they can be large (point lists, list items).
  const opsPerId = new Map<string, number>();
  for (const op of ops) {
    const id = op.op === "create" ? op.element.id : op.id;
    opsPerId.set(id, (opsPerId.get(id) ?? 0) + 1);
  }
  const several = ids.filter((id) => opsPerId.get(id)! > 1);
  const creates = ops.some((op) => op.op === "create");
  const [rows, propRows, counted] = await Promise.all([
    prisma.element.findMany({
      where: { boardId: board.id, id: { in: ids } },
      select: { id: true, version: true, deletedAt: true },
    }),
    several.length > 0
      ? prisma.element.findMany({
          where: { boardId: board.id, id: { in: several } },
          select: { id: true, props: true },
        })
      : [],
    creates
      ? prisma.board.findUnique({ where: { id: board.id }, select: { elementCount: true } })
      : null,
  ]);
  const storedProps = new Map(propRows.map((row) => [row.id, row.props]));
  const existing = new Map<string, Existing>(
    rows.map((row) => [row.id, { ...row, props: storedProps.get(row.id) }]),
  );

  const now = new Date();
  // New rows depend on nothing else in the batch, so they're inserted first, in one query.
  const inserts: Prisma.ElementCreateManyInput[] = [];
  const updates: BatchedUpdate[] = [];
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const applied: ElementOp[] = [];
  const stale: string[] = [];
  // Live elements added less those deleted, for the board's elementCount.
  let added = 0;
  for (const op of ops) {
    const id = op.op === "create" ? op.element.id : op.id;
    const before = existing.get(id);
    const update = opsPerId.get(id) === 1 ? batchedUpdateFor(op, before) : null;
    if (op.op === "create" && !before) {
      inserts.push(createData(board.id, op));
    } else if (update) {
      updates.push(update);
    } else {
      const write = writeFor(board.id, op, before, now);
      if (!write) {
        stale.push(id);
        continue;
      }
      writes.push(write);
    }
    applied.push(op);
    // A create adds a live element unless it rewrote one that was live already; an applied
    // delete always removes a live one.
    if (op.op === "create" && (!before || before.deletedAt)) added++;
    if (op.op === "delete") added--;
    if (opsPerId.get(id) === 1) continue;
    // Later ops on the same element see this one's result.
    const version = op.op === "create" ? op.element.version : op.version;
    const props =
      op.op === "update"
        ? mergeProps(before?.props, split(op.changes as Record<string, unknown>).props)
        : op.op === "create"
          ? createData(board.id, op).props
          : before?.props;
    existing.set(id, { id, version, deletedAt: op.op === "delete" ? now : null, props });
  }

  if (added > 0 && (counted?.elementCount ?? 0) + added > BOARD_ELEMENTS_MAX) {
    throw new HttpError(
      413,
      `A board holds up to ${BOARD_ELEMENTS_MAX.toLocaleString("en")} elements. Delete some, or start a new board.`,
    );
  }

  if (inserts.length > 0 || updates.length > 0 || writes.length > 0) {
    await prisma.$transaction(
      [
        ...(inserts.length > 0 ? [prisma.element.createMany({ data: inserts })] : []),
        ...updateStatements(board.id, updates, now),
        ...writes,
        touchStatement(board.id, now, added),
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
  limitPerUser(LIMITS.savesPerMinute),
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
