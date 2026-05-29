-- Phase 9.20 Tier 3  departure capture + retention snapshot.
--
-- Two surfaces in one migration (same week, same plan section):
--
--   placement_departure_category   the structured "fact" of why this
--                                   placement ended. SA labour-relations
--                                   vocabulary; deliberately captures the
--                                   *category* only, not the *reason*. D4
--                                   in the plan explains why  recording
--                                   the reason would turn Sebenza into a
--                                   record-of-truth for LRA / CCMA
--                                   disputes, which is D0 territory.
--
--   placements.departure_category   set by the new
--                                   markPlacementDeparted server action.
--                                   Nullable; only meaningful when the
--                                   placement is current_status='departed'.
--
--   placement_retention_snapshots   nightly aggregate of placements by
--                                   profession × province × milestone
--                                   window, k-thresholded at 10
--                                   (existing Phase 9.7 LMI threshold).
--                                   Drives the new /insights surface
--                                   without ever leaking per-employer
--                                   numbers.

-- ── Departure category enum + column ─────────────────────────────────

CREATE TYPE "placement_departure_category" AS ENUM (
  'resigned',
  'contract_ended',
  'dismissed',
  'retrenched',
  'moved_internally',
  'mutual_separation',
  'other'
);

ALTER TABLE "placements"
  ADD COLUMN IF NOT EXISTS "departure_category" "placement_departure_category";

-- Retention-snapshot cron filter path: pull every departed placement
-- with its date + category, grouped on (profession, province) by way
-- of the joined profile row. The composite covers the per-(category,
-- departure_date) read pattern; current_status filtering happens in
-- the cron SQL.
CREATE INDEX IF NOT EXISTS "placements_departed_category_date_idx"
  ON "placements" ("departure_category", "departure_date")
  WHERE "current_status" = 'departed';

-- ── Retention snapshot table ─────────────────────────────────────────
--
-- One row per (profession, province, milestone_window, captured_at)
-- pair, populated by the /api/cron/placement-retention-snapshot route.
-- Suppression of small cells (k < 10) happens at the read site, not
-- here  the raw aggregate is honest, the publication is filtered.
--
-- `milestone_months`  the window we're reporting against (3 / 6 /
-- 12 / 24 / 36 / ...). Matches the lifecycle cadence used by the
-- check-in cron + UI.
--
-- `hired_in_cohort`  count of placements where hired_at + N months
-- has elapsed by the capture date (i.e. eligible to count toward this
-- milestone). The denominator of the retention rate.
--
-- `still_active_at_milestone`  count of those who were `active` at
-- the milestone date. Numerator. NOT a snapshot of "are they still
-- active now"  the retention question is "did they make it to the
-- milestone," not "are they still there today."

CREATE TABLE IF NOT EXISTS "placement_retention_snapshots" (
  "id"                         text PRIMARY KEY,
  "captured_at"                timestamptz NOT NULL DEFAULT now(),
  "profession_slug"            text NOT NULL,
  "province_slug"              text NOT NULL,
  "milestone_months"           int NOT NULL,
  "hired_in_cohort"            int NOT NULL,
  "still_active_at_milestone"  int NOT NULL
);

-- Read path: /insights deep-link by (profession × province), and the
-- "latest snapshot only" filter that the UI applies. Single composite
-- index covers both.
CREATE INDEX IF NOT EXISTS "placement_retention_snapshots_lookup_idx"
  ON "placement_retention_snapshots" (
    "profession_slug",
    "province_slug",
    "milestone_months",
    "captured_at" DESC
  );
