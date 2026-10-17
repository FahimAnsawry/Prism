import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { redirect } from "@tanstack/react-router";
import { createAuthClient } from "better-auth/react";
import { SERVER_UNREACHABLE } from "./api";
import { reportError } from "./errors";

// Better Auth runs on the Express server; the client adds the /api/auth base path itself.
// oauthProviderClient: when an AI editor's sign-in (MCP OAuth) sent the user to /login, it
// passes the signed request along with the sign-in, and the server continues that flow.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL,
  plugins: [oauthProviderClient()],
});

/**
 * Whether this page is part of an AI editor's sign-in: Better Auth sent the user here with a
 * signed authorization request. Signing in then continues to the consent page (Better Auth's
 * client follows that redirect), not to the dashboard.
 */
export function inOAuthFlow() {
  const query = new URLSearchParams(window.location.search);
  return query.has("sig") && query.has("client_id");
}

/** Absolute URL on this app. OAuth redirects come back from the server, so a bare path would resolve there. */
export function appUrl(path: string) {
  return new URL(path, window.location.origin).href;
}

const ALREADY_EXISTS =
  "An account with this email already exists. Log in, or continue with Google or GitHub if you signed up that way.";

// Better Auth error codes (API errors and the OAuth `?error=` param) mapped to messages users can act on.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD:
    "That email and password don't match. Try again, or continue with Google or GitHub.",
  USER_ALREADY_EXISTS: ALREADY_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_EXISTS,
  EMAIL_NOT_VERIFIED:
    "Verify your email first. We just sent a new link: open it, then log in. Check your spam folder too.",
  PASSWORD_TOO_SHORT: "Use 8 or more characters.",
  PASSWORD_TOO_LONG: "Use 128 characters or fewer.",
  account_not_linked:
    "This email already has a Prism account. Log in with the method you used before.",
  unable_to_link_account: "We couldn't connect that sign-in method to your account. Try again.",
  email_not_found:
    "GitHub didn't share an email address. Make your primary email verified and try again.",
  email_not_verified: "Verify your email with the provider first, then try again.",
  access_denied: "Sign-in was cancelled.",
  INVALID_TOKEN: "This reset link is invalid or has expired. Please request a new one.",
};

export function authErrorMessage(code: string | undefined) {
  return (
    (code && AUTH_ERROR_MESSAGES[code]) || "Something went wrong signing you in. Please try again."
  );
}

/**
 * Runs a Better Auth call and returns a message to show, or undefined on success.
 * Better Auth returns API errors, but a network failure (server down, offline) throws.
 */
export async function runAuthAction(
  action: () => Promise<{ error: { code?: string | undefined } | null }>,
) {
  try {
    // Its reply clears the session cookies, so it mustn't land after a new sign-in.
    if (signingOut) await signingOut;
    const { error } = await action();
    return error ? authErrorMessage(error.code) : undefined;
  } catch (error) {
    reportError(error, { source: "promise", during: "auth" });
    return SERVER_UNREACHABLE;
  }
}

type SessionData = Awaited<ReturnType<typeof authClient.getSession>>["data"];

/** After this long a remembered session is checked again, in the background. */
const SESSION_FRESH_MS = 30_000;

/** The last session check: route guards reuse it instead of a round trip per navigation. */
let lastSession: { at: number; data: Promise<SessionData> } | null = null;

function checkSession() {
  const entry = {
    at: Date.now(),
    data: authClient.getSession().then(({ data }) => data),
  };
  lastSession = entry;
  // A failed check (server unreachable) isn't remembered.
  entry.data.catch(() => {
    if (lastSession === entry) lastSession = null;
  });
  return entry.data;
}

// Signing in or out (and changing the account) runs the next check again.
authClient.$store.listen("$sessionSignal", () => {
  lastSession = null;
});

/** A sign-out still on its way to the server. */
let signingOut: Promise<void> | null = null;

/**
 * Signs out without waiting for the server: the tab counts as signed out at once, so /login
 * opens straight away instead of after two round trips. Signing in again waits for it.
 */
export function signOut() {
  lastSession = { at: Date.now(), data: Promise.resolve(null) };
  const request = authClient.signOut().then(
    () => {},
    (error: unknown) => {
      reportError(error, { source: "promise", during: "auth" });
    },
  );
  signingOut = request;
  void request.finally(() => {
    if (signingOut === request) signingOut = null;
  });
}

/**
 * Route guard: sends signed-out visitors to /login. If the server can't be reached, the route's
 * error page shows. A signed-in user's session is remembered, so moving between the dashboard
 * and boards doesn't wait on the server; it's checked again in the background now and then.
 * The API checks the session on every request either way.
 */
export async function requireSession() {
  const remembered = lastSession;
  let data: SessionData;
  if (remembered) {
    data = await remembered.data;
    if (data && Date.now() - remembered.at > SESSION_FRESH_MS) void checkSession().catch(() => {});
    if (!data) data = await checkSession();
  } else {
    data = await checkSession();
  }
  if (!data) throw redirect({ to: "/login" });
  return data;
}

/**
 * Route guard for /login and /signup: signed-in users go straight to the dashboard.
 * A session checked moments ago (just signed out, or just sent here by requireSession) is reused.
 * If the session can't be checked, the form still shows; submitting it then reports the problem.
 */
export async function redirectIfSignedIn() {
  if (inOAuthFlow()) return;
  let signedIn = false;
  try {
    const remembered = lastSession;
    const fresh = remembered && Date.now() - remembered.at <= SESSION_FRESH_MS;
    signedIn = Boolean(await (fresh ? remembered.data : checkSession()));
  } catch (error) {
    reportError(error, { source: "router", during: "session check" });
  }
  if (signedIn) throw redirect({ to: "/dashboard" });
}
