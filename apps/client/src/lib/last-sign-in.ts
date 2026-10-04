// Remembers which sign-in method this browser used last, for the "Last used" tag on /login.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

export type SignInMethod = "google" | "github" | "email";

const KEY = "prism:last-sign-in";

export function readLastSignIn(): SignInMethod | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "google" || value === "github" || value === "email" ? value : null;
  } catch {
    return null;
  }
}

export function rememberLastSignIn(method: SignInMethod) {
  try {
    localStorage.setItem(KEY, method);
  } catch {
    // Not critical: the tag simply won't show next time.
  }
}
