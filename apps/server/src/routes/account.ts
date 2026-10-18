import { randomUUID } from "node:crypto";
import { PHOTO_MAX_BYTES, PHOTO_TYPES, type ConnectedEditor } from "@prism/shared";
import express, { Router } from "express";
import { prisma } from "../db/client.js";
import { refuseDemoUser } from "../demo.js";
import { badRequest, notFound } from "../errors.js";
import { LIMITS, limitPerUser } from "../rate-limit.js";
import { requireUser } from "../session.js";
import { getObject, putObject } from "../storage.js";
import { forgetGrant } from "../mcp/grants.js";

// The profile page's own data: the uploaded photo and the AI editors signed in through OAuth.
// Name, sign-in methods, password, sessions and deleting the account go through Better Auth.

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const TYPES_BY_EXTENSION = new Map(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]));

/** Checks the file's first bytes, so a mislabeled upload can't be served as an image. */
function isImage(type: string, bytes: Uint8Array) {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (type === "image/webp") {
    return starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

/** Photo uploads parse their own (raw) bodies, so this router comes before express.json(). */
export const photoRouter = Router();

photoRouter.post(
  "/account/photo",
  requireUser,
  limitPerUser(LIMITS.uploadsPerHour, LIMITS.uploadsPerDay),
  express.raw({ type: [...PHOTO_TYPES], limit: PHOTO_MAX_BYTES }),
  async (req, res) => {
    await refuseDemoUser(res.locals.userId);
    const type = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const extension = EXTENSIONS[type];
    if (!extension || !(req.body instanceof Buffer) || req.body.length === 0) {
      throw badRequest("Upload a PNG, JPEG or WebP image.");
    }
    if (!isImage(type, req.body)) throw badRequest("That file isn't a valid image.");

    // A new name each time, so the photo can be cached for good.
    const imageKey = `avatars/${randomUUID()}.${extension}`;
    await putObject(imageKey, req.body, type);
    await prisma.user.update({ where: { id: res.locals.userId }, data: { imageKey } });
    res.status(201).json({ imageKey });
  },
);

export const accountRouter = Router();

accountRouter.use("/account", requireUser);

/** Back to the sign-in provider's photo (or none). */
accountRouter.delete("/account/photo", async (_req, res) => {
  await refuseDemoUser(res.locals.userId);
  await prisma.user.update({ where: { id: res.locals.userId }, data: { imageKey: null } });
  res.json({ imageKey: null });
});

/** AI editors the user approved through OAuth, with the last time each got a token. */
accountRouter.get("/account/editors", async (_req, res) => {
  const userId = res.locals.userId;
  // Access tokens are often signed JWTs that aren't stored, so refresh tokens count too.
  const [consents, used, refreshed] = await Promise.all([
    prisma.oauthConsent.findMany({
      where: { userId },
      select: { clientId: true, createdAt: true, client: { select: { name: true } } },
    }),
    prisma.oauthAccessToken.groupBy({
      by: ["clientId"],
      where: { userId },
      _max: { createdAt: true },
    }),
    prisma.oauthRefreshToken.groupBy({
      by: ["clientId"],
      where: { userId },
      _max: { createdAt: true },
    }),
  ]);
  const lastUsed = new Map<string, Date | null>();
  for (const row of [...used, ...refreshed]) {
    const time = row._max.createdAt;
    const known = lastUsed.get(row.clientId);
    if (!known || (time && time > known)) lastUsed.set(row.clientId, time);
  }
  // A client that skipped consent still shows, through its tokens.
  const clientIds = [...new Set([...consents.map((c) => c.clientId), ...lastUsed.keys()])];
  const names = new Map(
    (
      await prisma.oauthClient.findMany({
        where: { clientId: { in: clientIds } },
        select: { clientId: true, name: true },
      })
    ).map((c) => [c.clientId, c.name]),
  );
  const editors: ConnectedEditor[] = clientIds
    .map((clientId) => {
      const consent = consents.find((c) => c.clientId === clientId);
      return {
        clientId,
        name: names.get(clientId) || "AI editor",
        connectedAt: consent?.createdAt?.toISOString() ?? null,
        lastUsedAt: lastUsed.get(clientId)?.toISOString() ?? null,
      };
    })
    .sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""));
  res.json({ editors });
});

/** Signs an editor out: its consent and every token it holds for this user. */
accountRouter.delete("/account/editors/:clientId", async (req, res) => {
  const userId = res.locals.userId;
  const clientId = req.params.clientId;
  const [consents, access, refresh] = await prisma.$transaction([
    prisma.oauthConsent.deleteMany({ where: { userId, clientId } }),
    prisma.oauthAccessToken.deleteMany({ where: { userId, clientId } }),
    prisma.oauthRefreshToken.deleteMany({ where: { userId, clientId } }),
  ]);
  forgetGrant(userId, clientId);
  if (consents.count + access.count + refresh.count === 0) {
    throw notFound("That editor isn't connected anymore.");
  }
  res.json({ clientId });
});

/** Uploaded photos, public by unguessable name like board uploads. */
export const avatarFileRouter = Router();

avatarFileRouter.get("/avatars/:file", async (req, res) => {
  const match = /^[0-9a-f-]{36}\.(png|jpg|webp)$/.exec(req.params.file);
  const type = match && TYPES_BY_EXTENSION.get(match[1] ?? "");
  if (!type) throw notFound("File not found.");
  const object = await getObject(`avatars/${req.params.file}`);
  if (!object) throw notFound("File not found.");
  res.set({
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  res.send(Buffer.from(object.bytes));
});
