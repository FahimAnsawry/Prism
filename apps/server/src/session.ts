import { createHash, randomBytes } from "node:crypto";
import { API_TOKEN_PREFIX } from "@prism/shared";
import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { prisma } from "./db/client.js";
import { unauthorized } from "./errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express types are a global namespace
  namespace Express {
    interface Locals {
      /** Set by requireUser. */
      userId: string;
    }
  }
}

// ── Personal access tokens: an alternative to OAuth for the MCP endpoint (src/mcp) ──

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new random token. Only its hash is stored. */
export function newToken() {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** How often lastUsedAt is refreshed, so a busy bridge doesn't write on every request. */
const LAST_USED_STEP = 60_000;

/** The user a personal access token belongs to, or null if no such token exists. */
export async function userForToken(token: string) {
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, lastUsedAt: true },
  });
  if (!row) return null;
  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_STEP) {
    prisma.apiToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } })
      .catch((error: unknown) => console.error("[Prism] Couldn't mark a token as used:", error));
  }
  return row.userId;
}

/** Rejects requests without a Better Auth session; otherwise puts the user's id on res.locals. */
export const requireUser: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw unauthorized("Sign in to continue.");
  res.locals.userId = session.user.id;
  next();
};
