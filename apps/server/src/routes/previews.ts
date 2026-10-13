import express, { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { badRequest, notFound } from "../errors.js";
import { requireUser } from "../session.js";
import { deleteObject, getObject, putObject } from "../storage.js";
import { boardFor } from "./board-access.js";
import { matchesSignature } from "./uploads.js";

// The cover picture of a board, shown on dashboard cards: one small WebP (PNG where the browser
// can't encode WebP) of the board's cover frame. Whichever client finds it older than the board
// draws it and uploads it here, so every device then downloads the same few KB instead of
// drawing the board itself. Stored under the board's `thumbnailKey`; `thumbnailEditedAt` is the
// board version it shows.

/** A cover picture is about 520x300 px; anything bigger isn't one. */
export const PREVIEW_MAX_BYTES = 256 * 1024;

const EXTENSIONS: Record<string, string> = { "image/webp": "webp", "image/png": "png" };
const TYPES_BY_EXTENSION = new Map(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]));

const uploadQuery = z.object({ editedAt: z.iso.datetime() });

const currentKey = async (boardId: string) =>
  (await prisma.board.findUnique({ where: { id: boardId }, select: { thumbnailKey: true } }))
    ?.thumbnailKey;

export const previewRouter = Router();

/**
 * Upload: an owner or editor stores the picture drawn from the board as of `editedAt` (the
 * board's `editedAt` the client saw). The newer version wins, so two tabs drawing the same
 * version, or a slow one finishing late, can't replace a fresher picture.
 */
previewRouter.put(
  "/boards/:boardId/preview",
  requireUser,
  express.raw({ type: Object.keys(EXTENSIONS), limit: PREVIEW_MAX_BYTES }),
  async (req, res) => {
    const board = await boardFor(req.params.boardId, res.locals.userId, "edit");

    const query = uploadQuery.safeParse(req.query);
    if (!query.success) throw badRequest("Say which version of the board the picture shows.");
    const editedAt = new Date(query.data.editedAt);

    const type = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const extension = EXTENSIONS[type];
    if (!extension || !(req.body instanceof Buffer) || req.body.length === 0) {
      throw badRequest("Send the picture as a WebP or PNG image.");
    }
    if (!matchesSignature(type, req.body)) throw badRequest("That file isn't a valid image.");

    const current = await prisma.board.findUnique({
      where: { id: board.id },
      select: { editedAt: true, thumbnailKey: true },
    });
    if (!current) throw notFound("Board not found.");
    // A picture can't show a version the board hasn't reached.
    if (editedAt > current.editedAt) throw badRequest("That version of the board doesn't exist.");

    // The version is in the key, so a picture still being fetched is never overwritten.
    const key = `${board.id}/preview-${editedAt.getTime()}.${extension}`;
    await putObject(key, req.body, type);

    const { count } = await prisma.board.updateMany({
      where: {
        id: board.id,
        OR: [{ thumbnailEditedAt: null }, { thumbnailEditedAt: { lt: editedAt } }],
      },
      data: { thumbnailKey: key, thumbnailEditedAt: editedAt },
    });

    // Whichever picture lost is dropped (unless both are the same object); a failed delete only
    // leaves a small orphan behind.
    const stored = count === 1 ? key : await currentKey(board.id);
    const lost = count === 1 ? current.thumbnailKey : key;
    if (lost && lost !== stored) {
      await deleteObject(lost).catch((error: unknown) => {
        console.warn("[Prism] Couldn't remove a board preview:", error);
      });
    }
    res.json({ stored: count === 1 });
  },
);

/**
 * Download: anyone who can view the board. Not public, unlike uploaded images: the dashboard
 * fetches it with the session and draws the blob. The client's URL carries the version, so the
 * picture caches for good.
 */
previewRouter.get("/boards/:boardId/preview", requireUser, async (req, res) => {
  const board = await boardFor(req.params.boardId, res.locals.userId, "view");
  await sendPreview(res, board.id);
});

/** Sends the board's stored picture, or a 404 when it has none (a caller checked access). */
export async function sendPreview(res: Response, boardId: string) {
  const key = await currentKey(boardId);
  if (!key) throw notFound("This board has no preview picture yet.");

  const object = await getObject(key);
  if (!object) throw notFound("This board has no preview picture yet.");

  res.set({
    "Content-Type": TYPES_BY_EXTENSION.get(key.split(".").pop() ?? "") ?? "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=31536000, immutable",
  });
  res.send(Buffer.from(object.bytes));
}

/** Removes the stored pictures of boards that are gone; a failure only leaves small orphans. */
export async function deletePreviews(keys: (string | null)[]) {
  await Promise.all(
    keys.map(async (key) => {
      if (!key) return;
      await deleteObject(key).catch((error: unknown) => {
        console.warn("[Prism] Couldn't remove a board preview:", error);
      });
    }),
  );
}
