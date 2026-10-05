import { randomUUID } from "node:crypto";
import { IMAGE_TYPES, SVG_TYPE, UPLOAD_MAX_BYTES } from "@prism/shared";
import express, { Router } from "express";
import { prisma } from "../db/client.js";
import { badRequest, notFound } from "../errors.js";
import { requireUser } from "../session.js";
import { getObject, putObject } from "../storage.js";
import { sanitizeSvg } from "../svg-sanitize.js";
import { BOARD_NOT_FOUND, liveBoardWhere, uuidParam } from "./board-access.js";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  [SVG_TYPE]: "svg",
};
const TYPES_BY_EXTENSION = new Map(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]));

/** Checks a raster file's first bytes, so a mislabeled upload can't be served as an image. */
function matchesSignature(type: string, bytes: Uint8Array) {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  switch (type) {
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/gif":
      return starts(0x47, 0x49, 0x46, 0x38);
    case "image/webp":
      return (
        starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
      );
    default:
      return false;
  }
}

/** Upload: a signed-in user adds a file to one of their boards. */
export const uploadRouter = Router();

uploadRouter.post(
  "/boards/:boardId/uploads",
  requireUser,
  express.raw({ type: [...IMAGE_TYPES, SVG_TYPE], limit: UPLOAD_MAX_BYTES }),
  async (req, res) => {
    const boardId = uuidParam(req.params.boardId);
    const board = boardId
      ? await prisma.board.findFirst({
          where: { id: boardId, ...liveBoardWhere(res.locals.userId) },
          select: { id: true },
        })
      : null;
    if (!board) throw notFound(BOARD_NOT_FOUND);

    const type = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const extension = EXTENSIONS[type];
    if (!extension || !(req.body instanceof Buffer) || req.body.length === 0) {
      throw badRequest("Upload a PNG, JPEG, GIF, WebP or SVG file.");
    }

    let bytes: Uint8Array = req.body;
    if (type === SVG_TYPE) {
      // Sanitized again here: the browser's pass can't be trusted.
      const clean = sanitizeSvg(req.body.toString("utf8"));
      if (!clean) throw badRequest("That file isn't a valid SVG.");
      bytes = Buffer.from(clean, "utf8");
    } else if (!matchesSignature(type, bytes)) {
      throw badRequest("That file isn't a valid image.");
    }

    const assetKey = `${board.id}/${randomUUID()}.${extension}`;
    await putObject(assetKey, bytes, type);
    res.status(201).json({ assetKey });
  },
);

/**
 * Serving: public, like a CDN link, since <image href> can't send credentials cross-site. Keys
 * contain a random UUID, so they can't be guessed. Files never change, so they cache for good.
 */
export const fileRouter = Router();

fileRouter.get("/uploads/:boardId/:file", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const match = /^([0-9a-f-]{36})\.(png|jpg|gif|webp|svg)$/.exec(req.params.file);
  if (!boardId || !match || !uuidParam(match[1])) throw notFound("File not found.");
  const type = TYPES_BY_EXTENSION.get(match[2] ?? "");
  if (!type) throw notFound("File not found.");

  const object = await getObject(`${boardId}/${req.params.file}`);
  if (!object) throw notFound("File not found.");

  res.set({
    "Content-Type": type,
    // Even opened directly, an uploaded SVG can't run script or load anything external.
    "Content-Security-Policy":
      "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    "X-Content-Type-Options": "nosniff",
    // The client (another origin in development) draws these in its canvas.
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  res.send(Buffer.from(object.bytes));
});
