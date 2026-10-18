import type { Prisma } from "./db/generated/client.js";
import { prisma } from "./db/client.js";
import { expireDemoAccess } from "./demo.js";
import { TOMBSTONE_KEEP_MS } from "./routes/elements.js";

// Hourly housekeeping: rows nothing needs any more are deleted for good.
//
// A deleted element stays as a tombstone (deletedAt set) so a stale update can't bring it back
// and an undo can. After TOMBSTONE_KEEP_MS nothing needs it any more. An undo after that still
// works, as a new element with the old id.
//
// Finished "Ask AI" requests go after EDIT_REQUEST_KEEP_MS (the browser lists a board's latest).
//
// OAuth tokens of MCP clients go once they can't be used: an access token when it expires or is
// revoked, a refresh token when it expires. A revoked refresh token is kept until then: Better
// Auth revokes one when it's rotated, and a later replay of it revokes the whole token family
// (theft detection), which needs the row. An expired one is refused before that check.
//
// AI editors connected to the public demo account are signed out after a day (demo.ts).

/** How often the purge runs. */
const PURGE_EVERY_MS = 60 * 60_000;
/** The first run, a little after startup. */
const FIRST_PURGE_MS = 60_000;
/** Rows per DELETE, so no one statement holds locks for long. */
const PURGE_BATCH = 500;
/** How long a done or failed edit request is kept. */
const EDIT_REQUEST_KEEP_MS = 30 * 24 * 60 * 60_000;

/** A time as SQL: Prisma keeps DateTime as UTC in a column without a time zone. */
const utc = (ms: number) => new Date(ms).toISOString();

/** Runs a batched DELETE until a batch comes back short. Returns how many rows went. */
async function deleteInBatches(batch: () => Prisma.PrismaPromise<number>) {
  let total = 0;
  for (;;) {
    const count = await batch();
    total += count;
    if (count < PURGE_BATCH) return total;
  }
}

/** Deletes tombstones older than TOMBSTONE_KEEP_MS, a batch at a time. Returns how many. */
export function purgeTombstones() {
  const cutoff = utc(Date.now() - TOMBSTONE_KEEP_MS);
  return deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM "element"
      WHERE ("boardId", "id") IN (
        SELECT "boardId", "id" FROM "element"
        WHERE "deletedAt" < (${cutoff}::timestamptz AT TIME ZONE 'UTC')
        LIMIT ${PURGE_BATCH}
      )`,
  );
}

/** Deletes edit requests that finished (done or failed) over EDIT_REQUEST_KEEP_MS ago. */
export function purgeEditRequests() {
  const cutoff = utc(Date.now() - EDIT_REQUEST_KEEP_MS);
  return deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM "edit_request"
      WHERE "id" IN (
        SELECT "id" FROM "edit_request"
        WHERE "status" IN ('done', 'failed')
          AND "updatedAt" < (${cutoff}::timestamptz AT TIME ZONE 'UTC')
        LIMIT ${PURGE_BATCH}
      )`,
  );
}

/** Deletes OAuth access tokens that expired or were revoked, and refresh tokens that expired. */
export async function purgeOauthTokens() {
  const now = utc(Date.now());
  // Refresh tokens first: their access tokens go with them (onDelete: Cascade).
  const refresh = await deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM "oauth_refresh_token"
      WHERE "id" IN (
        SELECT "id" FROM "oauth_refresh_token"
        WHERE "expiresAt" < (${now}::timestamptz AT TIME ZONE 'UTC')
        LIMIT ${PURGE_BATCH}
      )`,
  );
  const access = await deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM "oauth_access_token"
      WHERE "id" IN (
        SELECT "id" FROM "oauth_access_token"
        WHERE "expiresAt" < (${now}::timestamptz AT TIME ZONE 'UTC') OR "revoked" IS NOT NULL
        LIMIT ${PURGE_BATCH}
      )`,
  );
  return { refresh, access };
}

let running = false;

/** Runs one purge, logging what it deleted or why it failed, so one failure doesn't stop the rest. */
async function attempt(what: string, purge: () => Promise<number>) {
  try {
    const count = await purge();
    if (count > 0) console.log(`[Prism] Purged ${count} ${what}.`);
  } catch (error) {
    console.warn(`[Prism] Couldn't purge ${what}:`, error);
  }
}

async function runPurge() {
  if (running) return;
  running = true;
  try {
    await attempt("deleted elements older than 30 days", purgeTombstones);
    await attempt("edit requests finished over 30 days ago", purgeEditRequests);
    await attempt("expired or revoked OAuth tokens", async () => {
      const { refresh, access } = await purgeOauthTokens();
      return refresh + access;
    });
    await attempt("demo account editor sign-ins older than a day", expireDemoAccess);
  } finally {
    running = false;
  }
}

/** Runs the purges every PURGE_EVERY_MS for as long as the server runs. */
export function startPurges() {
  setTimeout(() => void runPurge(), FIRST_PURGE_MS).unref();
  setInterval(() => void runPurge(), PURGE_EVERY_MS).unref();
}
