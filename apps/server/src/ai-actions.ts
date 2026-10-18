import { createHash, randomUUID } from "node:crypto";
import { type BoardElement, type EditRequest, SVG_TYPE, UPLOAD_MAX_BYTES } from "@prism/shared";
import type { EditStatus } from "./db/generated/client.js";
import { prisma } from "./db/client.js";
import { badRequest, HttpError, notFound } from "./errors.js";
import { downloadImage } from "./image-import.js";
import {
  announceAiEdit,
  broadcastEdit,
  broadcastEditDeleted,
  broadcastOps,
  latestSelection,
} from "./realtime.js";
import { accessibleBoardWhere, boardFor } from "./routes/board-access.js";
import { applyOps, elementsReplyBody, toElement } from "./routes/elements.js";
import { putObject } from "./storage.js";
import { sanitizeSvg, svgSize, unsafeSvgParts } from "./svg-sanitize.js";

// What AI editors do besides plain element ops (src/mcp) and what the browser's "Ask AI" box
// shares with them: the live selection, image import and edit requests.

// ── Edit request rows ──────────────────────────────────────────────────────

type EditRow = {
  id: string;
  boardId: string;
  elementIds: string[];
  prompt: string;
  status: EditStatus;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const editSelect = {
  id: true,
  boardId: true,
  elementIds: true,
  prompt: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const toEditRequest = (row: EditRow): EditRequest => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * The board's live elements, bottom layer first. `board` comes from boardFor: its `editedAt`, read
 * before the elements, lets the elements route's remembered reply answer (elementsReplyBody).
 */
export async function loadElements(board: { id: string; editedAt: Date }): Promise<BoardElement[]> {
  const body = await elementsReplyBody(board.id, board.editedAt.getTime());
  return (JSON.parse(body) as { elements: BoardElement[] }).elements;
}

/** The live elements with these ids, bottom layer first. */
async function elementsByIds(boardId: string, ids: string[]): Promise<BoardElement[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.element.findMany({
    where: { boardId, id: { in: ids }, deletedAt: null },
    orderBy: { z: "asc" },
  });
  return rows.map(toElement);
}

// ── Selection ──────────────────────────────────────────────────────────────

/** What the user has selected in an open board tab: on `boardId`, else their latest board. */
export async function selectionFor(userId: string, boardId?: string) {
  if (boardId) boardId = (await boardFor(boardId, userId, "view")).id;
  const selection = latestSelection(userId, boardId);
  if (!selection) return { boardId: boardId ?? null, elements: [] };
  // The board could have been deleted or archived since the tab reported it.
  const board = await boardFor(selection.boardId, userId, "view");
  return { boardId: board.id, elements: await elementsByIds(board.id, selection.elementIds) };
}

// ── Image import ───────────────────────────────────────────────────────────

type DownloadedImage = Awaited<ReturnType<typeof downloadImage>>;

/**
 * The file name (without extension) a downloaded image gets: a hash of its source URL, so the same
 * photo has the same name on every board and search_images can tell which ones a site already uses.
 */
export const sourceFileStem = (url: string) =>
  createHash("sha256").update(url).digest("hex").slice(0, 32);

/** Saves an image downloaded from `url` with the board's files and returns its asset key. */
async function storeImage(boardId: string, url: string, image: DownloadedImage) {
  const assetKey = `${boardId}/${sourceFileStem(url)}.${image.extension}`;
  await putObject(assetKey, image.bytes, image.type);
  return assetKey;
}

/**
 * The asset key for an image fill's URL (`board` is an owned board's id): one of the board's own
 * files (a URL get_board showed) is reused, anything else is downloaded into the board's storage.
 */
export async function imageFillAsset(board: string, url: string) {
  const path = URL.canParse(url) ? new URL(url).pathname : "";
  const own = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(path);
  if (own?.[1] === board && own[2]) return `${board}/${own[2]}`;
  return storeImage(board, url, await downloadImage(url));
}

/** Display width for an imported image: phone screenshots narrower than desktop ones. */
function displayWidth(natural: { width: number; height: number }) {
  const portrait = natural.height > natural.width;
  return Math.min(natural.width, portrait ? 390 : 960);
}

interface Placement {
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
}

/**
 * Places a stored image or SVG `width` × `height` on the board (one from boardFor), by default to
 * the right of everything else, and tells open tabs.
 */
async function placeAsset(
  userId: string,
  board: { id: string; projectId: string | null },
  type: "image" | "svg",
  assetKey: string,
  input: Placement & { name?: string | undefined; role?: string | undefined },
  width: number,
  height: number,
) {
  // The live elements' right edge, top and top layer (all null on an empty board).
  const [placed] = await prisma.$queryRaw<
    { right: number | null; top: number | null; z: number | null }[]
  >`
    SELECT max("x" + greatest("width", 0)) AS "right", min("y") AS "top", max("z") AS "z"
    FROM "element"
    WHERE "boardId" = ${board.id} AND "deletedAt" IS NULL`;
  const x = input.x ?? Math.max(placed?.right ?? -80, -80) + 80;
  const y = input.y ?? placed?.top ?? 0;
  const z = Math.max(placed?.z ?? -1, -1) + 1;

  const element: BoardElement = {
    id: randomUUID(),
    version: 1,
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    z,
    stroke: "#3d3b4f",
    fill: null,
    strokeWidth: 2,
    strokeStyle: "solid",
    sketch: false,
    opacity: 1,
    updatedBy: "ai_agent",
    assetKey,
    ...(input.name && { groupId: input.name }),
    ...(input.role && { role: input.role }),
  };
  const { applied } = await applyOps(board, [{ op: "create", element }]);
  broadcastOps(board.id, applied);
  announceAiEdit(board.id, userId, applied);
  return element;
}

/**
 * Downloads an image from a public URL into the board's storage and places it as an image
 * element, by default to the right of everything else on the board.
 */
export async function importImage(
  userId: string,
  boardId: string,
  input: Placement & { url: string },
) {
  const board = await boardFor(boardId, userId, "edit");
  const image = await downloadImage(input.url);
  const assetKey = await storeImage(board.id, input.url, image);
  const width = input.width ?? displayWidth(image);
  const height = Math.round((width * image.height) / image.width);
  return placeAsset(userId, board, "image", assetKey, input, width, height);
}

/**
 * Checks SVG markup an AI editor wrote and stores it with the board. Refuses markup with unsafe
 * parts (naming them) instead of quietly dropping them, so the editor knows to fix it.
 */
export async function storeSvg(boardId: string, markup: string) {
  const unsafe = unsafeSvgParts(markup);
  if (unsafe.length > 0) {
    throw badRequest(
      `This SVG has parts Prism doesn't allow: ${unsafe.join(", ")}. Use plain shapes, text, gradients and filters, links only to #ids in the same SVG, and no scripts or event handlers.`,
    );
  }
  const clean = sanitizeSvg(markup);
  if (!clean) throw badRequest("That isn't SVG markup: it needs an <svg> root element.");
  const bytes = Buffer.from(clean, "utf8");
  if (bytes.length > UPLOAD_MAX_BYTES) throw badRequest("That SVG is over the 10 MB limit.");
  const assetKey = `${boardId}/${randomUUID()}.svg`;
  await putObject(assetKey, bytes, SVG_TYPE);
  return { assetKey, ...svgSize(clean) };
}

/** Places SVG markup an AI editor wrote (a logo, an illustration) as an svg element. */
export async function importSvg(
  userId: string,
  boardId: string,
  input: Placement & { svg: string; name?: string | undefined; role?: string | undefined },
) {
  const board = await boardFor(boardId, userId, "edit");
  const svg = await storeSvg(board.id, input.svg);
  const width = input.width ?? svg.width;
  const height = Math.round(((width * svg.height) / svg.width) * 10) / 10;
  return placeAsset(userId, board, "svg", svg.assetKey, input, width, height);
}

// ── Edit requests ("Ask AI") ───────────────────────────────────────────────

const EDIT_NOT_FOUND = "That edit request no longer exists.";

/** A request handed out but never completed (the AI editor quit) is handed out again after this. */
const RECLAIM_AFTER_MS = 10 * 60_000;
/** Requests one wait returns at most. */
const WAIT_BATCH = 10;

/** An edit request handed to an AI editor, with its board's name and the selected elements. */
export type PendingEdit = EditRequest & { boardName: string; elements: BoardElement[] };

/** AI editors waiting for requests, per user: each is woken when a new request comes in. */
const waiters = new Map<string, Set<() => void>>();

/** Wakes the user's waiting AI editors (a request was just created). */
export function wakeEditWaiters(userId: string) {
  for (const wake of waiters.get(userId) ?? []) wake();
}

/** Resolves when a request comes in for the user, `ms` pass, or `signal` aborts. */
function waitForRequest(userId: string, ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const set = waiters.get(userId) ?? new Set();
    waiters.set(userId, set);
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      set.delete(done);
      if (set.size === 0) waiters.delete(userId);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
    set.add(done);
  });
}

/** Hands out the user's waiting requests (oldest first) and marks them as being worked on. */
async function claimRequests(userId: string, boardId: string | undefined): Promise<PendingEdit[]> {
  const reclaimBefore = new Date(Date.now() - RECLAIM_AFTER_MS);
  const rows = await prisma.editRequest.findMany({
    where: {
      userId,
      ...(boardId && { boardId }),
      // Only boards the user can still edit: one they were removed from is skipped.
      board: accessibleBoardWhere(userId, "edit"),
      OR: [{ status: "pending" }, { status: "working", claimedAt: { lt: reclaimBefore } }],
    },
    orderBy: { createdAt: "asc" },
    take: WAIT_BATCH,
    select: { ...editSelect, claimedAt: true, board: { select: { name: true } } },
  });

  // Each request is claimed on its own, all at once; the list stays oldest first.
  const claimed = await Promise.all(
    rows.map(async ({ board, claimedAt, ...row }): Promise<PendingEdit | null> => {
      // Another waiting editor may take the same request first; whoever updates it gets it.
      const { count } = await prisma.editRequest.updateMany({
        where: { id: row.id, status: row.status, claimedAt },
        data: { status: "working", claimedAt: new Date() },
      });
      if (count === 0) return null;
      const request = toEditRequest({ ...row, status: "working", updatedAt: new Date() });
      broadcastEdit(request);
      return {
        ...request,
        boardName: board.name,
        elements: await elementsByIds(row.boardId, row.elementIds),
      };
    }),
  );
  return claimed.filter((request) => request !== null);
}

/**
 * Waits up to `seconds` for the user's "Ask AI" requests (on `boardId`, or any board) and claims
 * them. Answers early when requests arrive; an empty list means none came in time.
 */
export async function waitForEdits(
  userId: string,
  boardId: string | undefined,
  seconds: number,
  signal: AbortSignal,
) {
  if (boardId) boardId = (await boardFor(boardId, userId, "view")).id;
  const deadline = Date.now() + seconds * 1_000;
  for (;;) {
    // A caller that gave up mustn't claim requests it will never handle.
    if (signal.aborted) return [];
    const requests = await claimRequests(userId, boardId);
    const left = deadline - Date.now();
    if (requests.length > 0 || left <= 0) return requests;
    await waitForRequest(userId, left, signal);
  }
}

/**
 * Edits a request's prompt and/or pauses or resumes it. Only the user's own request that no AI
 * editor has picked up yet can change; the update is atomic, so a request an editor claims in the
 * meantime stays untouched and the caller is told.
 */
export async function updateEdit(
  userId: string,
  boardId: string,
  editId: string,
  input: { prompt?: string | undefined; paused?: boolean | undefined },
) {
  const where = { id: editId, boardId, userId };
  const { count } = await prisma.editRequest.updateMany({
    where: { ...where, status: { in: ["pending", "paused"] } },
    data: {
      ...(input.prompt !== undefined && { prompt: input.prompt }),
      ...(input.paused !== undefined && { status: input.paused ? "paused" : "pending" }),
    },
  });
  if (count === 0) {
    const exists = await prisma.editRequest.findFirst({ where, select: { id: true } });
    if (!exists) throw notFound(EDIT_NOT_FOUND);
    throw new HttpError(409, "An AI editor already picked this up, so it can't be changed now.");
  }
  const row = await prisma.editRequest.findUniqueOrThrow({
    where: { id: editId },
    select: editSelect,
  });
  const request = toEditRequest(row);
  broadcastEdit(request);
  if (request.status === "pending") wakeEditWaiters(userId);
  return request;
}

/** The note a request the user stopped ends with. */
const STOPPED_NOTE = "Stopped by you. The AI editor halts at its next Prism action.";

/**
 * Requests the user stopped while an AI editor was working on them, per user. The editor can't be
 * interrupted, so its next tool call is refused with this news instead (`takeStops`).
 */
const stops = new Map<string, { prompt: string; until: number }[]>();

function noteStop(userId: string, prompt: string) {
  const list = stops.get(userId) ?? [];
  list.push({ prompt, until: Date.now() + RECLAIM_AFTER_MS });
  stops.set(userId, list);
}

/**
 * Takes the user's pending stop news, once: the text to answer an AI editor's tool call with
 * (instead of running it), or undefined when the user stopped nothing.
 */
export function takeStops(userId: string) {
  const list = stops.get(userId)?.filter((stop) => stop.until > Date.now());
  stops.delete(userId);
  if (!list?.length) return undefined;
  const what = list.map((stop) => `"${stop.prompt.slice(0, 80)}"`).join(", ");
  return `The user stopped the Ask AI request ${what} in Prism. Stop working on it now: make no further changes for it, don't call complete_edit for it, and tell the user you stopped. Then call wait_for_edits again only if you were watching for requests.`;
}

/**
 * Stops a request an AI editor is working on: it ends as failed with a note, and the editor's
 * next tool call is refused with the news. Changes it already made stay on the board.
 */
export async function stopEdit(userId: string, boardId: string, editId: string) {
  const where = { id: editId, boardId, userId };
  const { count } = await prisma.editRequest.updateMany({
    where: { ...where, status: "working" },
    data: { status: "failed", note: STOPPED_NOTE },
  });
  const row = await prisma.editRequest.findFirst({ where, select: editSelect });
  if (!row) throw notFound(EDIT_NOT_FOUND);
  if (count === 0)
    throw new HttpError(409, "That request isn't being worked on, so there's nothing to stop.");
  noteStop(userId, row.prompt);
  const request = toEditRequest(row);
  broadcastEdit(request);
  return request;
}

/**
 * Deletes the user's request, whatever its status. One an AI editor is already working on is
 * stopped like `stopEdit`; its complete_edit will say the request no longer exists.
 */
export async function deleteEdit(userId: string, boardId: string, editId: string) {
  const where = { id: editId, boardId, userId };
  const before = await prisma.editRequest.findFirst({
    where,
    select: { status: true, prompt: true },
  });
  const { count } = await prisma.editRequest.deleteMany({ where });
  if (count === 0) throw notFound(EDIT_NOT_FOUND);
  if (before?.status === "working") noteStop(userId, before.prompt);
  broadcastEditDeleted(boardId, editId);
}

/** Finishes a request with the AI editor's note, which the browser shows. */
export async function completeEdit(
  userId: string,
  editId: string,
  status: "done" | "failed",
  note: string,
) {
  const existing = await prisma.editRequest.findFirst({
    where: { id: editId, userId },
    select: { ...editSelect },
  });
  if (!existing) throw notFound(EDIT_NOT_FOUND);
  // The user stopped it: an editor that finishes anyway doesn't turn that into "done".
  if (existing.status === "failed" && existing.note === STOPPED_NOTE)
    return toEditRequest(existing);
  const row = await prisma.editRequest.update({
    where: { id: existing.id },
    data: { status, note: note || null },
    select: editSelect,
  });
  const request = toEditRequest(row);
  broadcastEdit(request);
  return request;
}
