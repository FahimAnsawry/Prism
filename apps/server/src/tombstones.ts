import { prisma } from "./db/client.js";
import { TOMBSTONE_KEEP_MS } from "./routes/elements.js";

// A deleted element stays as a tombstone (deletedAt set) so a stale update can't bring it back
// and an undo can. After TOMBSTONE_KEEP_MS nothing needs it any more: it's deleted for good here.
// An undo after that still works, as a new element with the old id.

/** How often the purge runs. */
const PURGE_EVERY_MS = 60 * 60_000;
/** The first run, a little after startup. */
const FIRST_PURGE_MS = 60_000;
/** Rows per DELETE, so no one statement holds locks for long. */
const PURGE_BATCH = 500;

/** Deletes tombstones older than TOMBSTONE_KEEP_MS, a batch at a time. Returns how many. */
export async function purgeTombstones() {
  // Prisma keeps DateTime as UTC in a column without a time zone.
  const cutoff = new Date(Date.now() - TOMBSTONE_KEEP_MS).toISOString();
  let total = 0;
  for (;;) {
    const count = await prisma.$executeRaw`
      DELETE FROM "element"
      WHERE ("boardId", "id") IN (
        SELECT "boardId", "id" FROM "element"
        WHERE "deletedAt" < (${cutoff}::timestamptz AT TIME ZONE 'UTC')
        LIMIT ${PURGE_BATCH}
      )`;
    total += count;
    if (count < PURGE_BATCH) return total;
  }
}

let running = false;

async function runPurge() {
  if (running) return;
  running = true;
  try {
    const count = await purgeTombstones();
    if (count > 0) console.log(`[Prism] Purged ${count} deleted elements older than 30 days.`);
  } catch (error) {
    console.warn("[Prism] Couldn't purge old deleted elements:", error);
  } finally {
    running = false;
  }
}

/** Purges old tombstones every PURGE_EVERY_MS for as long as the server runs. */
export function startTombstonePurge() {
  setTimeout(() => void runPurge(), FIRST_PURGE_MS).unref();
  setInterval(() => void runPurge(), PURGE_EVERY_MS).unref();
}
