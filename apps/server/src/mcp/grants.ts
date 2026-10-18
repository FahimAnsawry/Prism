import { prisma } from "../db/client.js";

// An OAuth access token is a signed JWT, checked against the JWKS without the database, so
// deleting a user's grant ("Disconnect" on the profile page, or the account itself) wouldn't stop
// a token already issued. MCP requests therefore also check that the grant still exists: a
// consent or a token row for that user and client. Answers are kept for a short while, so a burst
// of tool calls asks the database once.

const GRANT_TTL_MS = 30_000;

const known = new Map<string, { live: boolean; at: number }>();

const keyOf = (userId: string, clientId: string) => `${userId}\n${clientId}`;

/** Whether the user still has `clientId` connected. */
export async function grantExists(userId: string, clientId: string) {
  const key = keyOf(userId, clientId);
  const cached = known.get(key);
  if (cached && Date.now() - cached.at < GRANT_TTL_MS) return cached.live;
  const where = { userId, clientId };
  const [consent, refresh, access] = await Promise.all([
    prisma.oauthConsent.findFirst({ where, select: { id: true } }),
    prisma.oauthRefreshToken.findFirst({ where, select: { id: true } }),
    prisma.oauthAccessToken.findFirst({ where, select: { id: true } }),
  ]);
  const live = Boolean(consent ?? refresh ?? access);
  known.set(key, { live, at: Date.now() });
  return live;
}

/** Forgets a cached answer, so a disconnect takes effect on the editor's next request. */
export function forgetGrant(userId: string, clientId: string) {
  known.delete(keyOf(userId, clientId));
}
