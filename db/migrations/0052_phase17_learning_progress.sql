-- Phase 17 ("The Climb")  self-paced progress on active learning items.
-- Idempotent (ADD COLUMN IF NOT EXISTS) so a db:push-recovered schema re-runs
-- as a no-op. NOT NULL DEFAULT 0 backfills existing rows to "not started".
ALTER TABLE "learning_items"
  ADD COLUMN IF NOT EXISTS "progress_percent" integer NOT NULL DEFAULT 0;
