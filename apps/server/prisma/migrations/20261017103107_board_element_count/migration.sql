-- AlterTable
ALTER TABLE "board" ADD COLUMN     "elementCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: each board's live elements.
UPDATE "board" AS b
SET "elementCount" = c.count
FROM (
  SELECT "boardId", count(*)::integer AS count
  FROM "element"
  WHERE "deletedAt" IS NULL
  GROUP BY "boardId"
) AS c
WHERE b."id" = c."boardId";
