import { prisma } from "./db/client.js";
import { HttpError } from "./errors.js";

/**
 * The public demo account (DEMO_EMAIL and DEMO_PASSWORD; see .env.example). Its sign-in is
 * shown to everyone (the login form fills it in), so nothing that would lock other visitors out
 * or change who it looks like is allowed: its password, email, name and photo stay as seeded and
 * it can't be deleted. Boards and projects work as for anyone else. `pnpm seed:demo` creates it.
 */
export const DEMO_EMAIL = process.env["DEMO_EMAIL"]?.trim().toLowerCase() || undefined;

export const DEMO_LOCKED_MESSAGE = "The demo account can't be changed. Sign up for your own.";

export const isDemoEmail = (email: string | null | undefined) =>
  !!DEMO_EMAIL && email?.trim().toLowerCase() === DEMO_EMAIL;

/** Better Auth endpoints that change the account itself, refused for the demo account. */
export const DEMO_LOCKED_AUTH_PATHS = new Set([
  "/change-password",
  "/set-password",
  "/change-email",
  "/update-user",
  "/delete-user",
  "/request-password-reset",
  "/forget-password",
  "/reset-password",
  // Linking a login would let one visitor sign in to it without the public password; revoking
  // sessions would sign every other visitor out.
  "/link-social",
  "/unlink-account",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
]);

/** Throws 403 when `userId` is the demo account (for the app's own profile routes). */
export async function refuseDemoUser(userId: string, message = DEMO_LOCKED_MESSAGE) {
  if (!DEMO_EMAIL) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (isDemoEmail(user?.email)) throw new HttpError(403, message);
}

/** How long an AI editor stays connected to the demo account. */
const DEMO_ACCESS_MS = 24 * 60 * 60_000;

/**
 * Signs AI editors out of the demo account a day after they connected, so one visitor's editor
 * can't keep acting on it for good (the purge job runs this every hour). Personal access tokens
 * and sharing are refused for the demo account, so OAuth grants are all there is to drop.
 */
export async function expireDemoAccess() {
  if (!DEMO_EMAIL) return 0;
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (!user) return 0;
  const before = new Date(Date.now() - DEMO_ACCESS_MS);
  const where = { userId: user.id, createdAt: { lt: before } };
  const [consents, refresh, access, tokens] = await prisma.$transaction([
    prisma.oauthConsent.deleteMany({ where }),
    prisma.oauthRefreshToken.deleteMany({ where }),
    prisma.oauthAccessToken.deleteMany({ where }),
    prisma.apiToken.deleteMany({ where }),
  ]);
  return consents.count + refresh.count + access.count + tokens.count;
}
