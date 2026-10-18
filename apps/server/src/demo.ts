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
]);

/** Throws 403 when `userId` is the demo account (for the app's own profile routes). */
export async function refuseDemoUser(userId: string) {
  if (!DEMO_EMAIL) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (isDemoEmail(user?.email)) throw new HttpError(403, DEMO_LOCKED_MESSAGE);
}
