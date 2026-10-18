import type { RequestHandler } from "express";
import { HttpError } from "./errors.js";

// Per-user limits on the costly or abusable actions (uploads, saves, invites, AI editor calls).
// Counters live in this process's memory: Prism runs as one long-lived Node process, and a
// restart only forgets the counts, never lets more through than one window allows.

interface Window {
  count: number;
  resetAt: number;
}

export interface Limit {
  /** Shown to the user when the limit is hit, after "Too many …". */
  what: string;
  max: number;
  windowMs: number;
}

const windows = new Map<string, Window>();

/** Expired windows are dropped now and then, so the map doesn't grow with every user ever seen. */
const SWEEP_EVERY_MS = 10 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
}, SWEEP_EVERY_MS).unref();

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

/** Counts one use of `limit` by `key` (usually a user id); throws a 429 once it's used up. */
export function spend(limit: Limit, key: string, amount = 1) {
  const now = Date.now();
  const id = `${limit.what}:${limit.windowMs}:${key}`;
  let window = windows.get(id);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + limit.windowMs };
    windows.set(id, window);
  }
  if (window.count + amount > limit.max) {
    throw new HttpError(
      429,
      `Too many ${limit.what}. Try again in ${minutes(window.resetAt - now)} min.`,
    );
  }
  window.count += amount;
}

/** Middleware form of spend for routes behind requireUser: every limit counts per user. */
export const limitPerUser =
  (...limits: Limit[]): RequestHandler =>
  (_req, res, next) => {
    for (const limit of limits) spend(limit, res.locals.userId);
    next();
  };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The limits Prism applies, in one place so they're easy to tune. */
export const LIMITS = {
  uploadsPerHour: { what: "uploads this hour", max: 120, windowMs: HOUR },
  uploadsPerDay: { what: "uploads today", max: 500, windowMs: DAY },
  savesPerMinute: { what: "saves this minute", max: 600, windowMs: MINUTE },
  editRequestsPerHour: { what: "Ask AI requests this hour", max: 120, windowMs: HOUR },
  sharesPerHour: { what: "people added or invited this hour", max: 30, windowMs: HOUR },
  sharesPerDay: { what: "people added or invited today", max: 100, windowMs: DAY },
  mcpCallsPerMinute: { what: "AI editor requests this minute", max: 600, windowMs: MINUTE },
  imageDownloadsPerHour: { what: "image downloads this hour", max: 300, windowMs: HOUR },
} satisfies Record<string, Limit>;
