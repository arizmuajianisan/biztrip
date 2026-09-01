ALTER TABLE "expenses" ADD COLUMN "sort_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: preserve the order existing expenses already read in, which is the
-- order they were logged within each day. Without this every row would sit at 0
-- and same-day ordering would fall back to created_at forever.
UPDATE "expenses" e
SET "sort_index" = r.rn
FROM (
  SELECT id, row_number() OVER (
    PARTITION BY trip_id, spent_at ORDER BY created_at, id
  ) AS rn
  FROM "expenses"
) r
WHERE e.id = r.id;
