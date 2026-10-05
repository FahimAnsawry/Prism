import { redirect } from "@tanstack/react-router";
import { createAuthClient } from "better-auth/react";
import { SERVER_UNREACHABLE } from "./api";
import { reportError } from "./errors";

// Better Auth runs on the Express server; the client adds the /api/auth base path itself.
export const authClient = createAuthClient({ baseURL: import.meta.env.VITE_SERVER_URL });

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
  PASSWORD_TOO_SHORT: "Use 8 or more characters.",
  PASSWORD_TOO_LONG: "Use 128 characters or fewer.",
  account_not_linked:
    "This email already has a Prism account. Log in with the method you used before.",
  unable_to_link_account: "We couldn't connect that sign-in method to your account. Try again.",
  email_not_found:
    "GitHub didn't share an email address. Make your primary email verified and try again.",
  email_not_verified: "Verify your email with the provider first, then try again.",
  access_denied: "Sign-in was cancelled.",
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
    const { error } = await action();
    return error ? authErrorMessage(error.code) : undefined;
  } catch (error) {
    reportError(error, { source: "promise", during: "auth" });
    return SERVER_UNREACHABLE;
  }
}

/** Route guard: sends signed-out visitors to /login. If the server can't be reached, the route's error page shows. */
export async function requireSession() {
  const { data } = await authClient.getSession();
  if (!data) throw redirect({ to: "/login" });
  return data;
}

/**
 * Route guard for /login and /signup: signed-in users go straight to the dashboard.
 * If the session can't be checked, the form still shows; submitting it then reports the problem.
 */
export async function redirectIfSignedIn() {
  let signedIn = false;
  try {
    signedIn = Boolean((await authClient.getSession()).data);
  } catch (error) {
    reportError(error, { source: "router", during: "session check" });
  }
  if (signedIn) throw redirect({ to: "/dashboard" });
}
