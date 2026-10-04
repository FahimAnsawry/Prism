/**
 * Central frontend error handling. Every caught error (router, React roots and boundaries,
 * window events, TanStack Query) goes through `reportError`, so logging lives in one place and an
 * external reporter can be plugged in here later.
 */

export type ErrorSource = "router" | "react" | "window" | "promise" | "query" | "mutation";

export type ErrorContext = {
  source: ErrorSource;
  componentStack?: string;
  [key: string]: unknown;
};

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

// The same Error can reach several hooks (e.g. a route render error hits both the router's
// onCatch and React's onCaughtError), so each one is reported once.
const reported = new WeakSet<Error>();

/** Turns any thrown value into an Error, keeping the original as `cause`. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  if (value && typeof value === "object" && "message" in value) {
    return new Error(String(value.message), { cause: value });
  }
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return new Error(`Non-error value thrown: ${text}`, { cause: value });
}

/** Logs an error in one consistent format. Returns the normalized Error. */
export function reportError(value: unknown, context: ErrorContext): Error {
  const error = toError(value);
  if (reported.has(error)) return error;
  reported.add(error);

  const { source, ...details } = context;
  console.groupCollapsed(`[Prism] ${source} error: ${error.message}`);
  console.error(error);
  if (Object.keys(details).length > 0) console.info(details);
  console.groupEnd();
  return error;
}

/**
 * A message that is safe to show users. Developer detail stays in the console; only plain
 * string errors and HTTP-ish client errors with their own message get through in production.
 */
export function getErrorMessage(value: unknown, fallback = GENERIC_MESSAGE): string {
  if (import.meta.env.DEV) return toError(value).message || fallback;
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "status" in value && "message" in value) {
    const status = Number(value.status);
    if (status >= 400 && status < 500 && typeof value.message === "string") return value.message;
  }
  return fallback;
}

let installed = false;

/** Catches anything that escapes React and the router. Safe to call more than once. */
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, {
      source: "window",
      file: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "promise" });
  });
}
