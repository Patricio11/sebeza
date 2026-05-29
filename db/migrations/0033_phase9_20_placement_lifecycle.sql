-- Phase 9.20 (Tier 1 + Tier 2)  Placements lifecycle schema.
--
-- Extends `placements` from a frozen hire log into a lifecycle record.
-- Phase 9.11 already captured the moment of hire; this migration adds
-- the tail  is the person STILL employed, when was that last
-- confirmed, and where did the employer's internal context for this
-- placement live. Plus the `placement_status_checks` ledger that
-- records every check-in event.
--
-- D0 reminder: this is OUTCOMES capture, not HRIS management. No
-- warnings, no performance ratings, no payroll, no leave. Tier 3
-- adds the departure capture path (separate migration 0034) so
-- this migration stays narrowly scoped to "still employed?" reads.
--
-- Columns on placements:
--
--   current_status         active / departed / unknown. Default
--                          'active' so every existing row migrates
--                          cleanly: a placement we logged is, by
--                          assumption, active until told otherwise.
--                          'unknown' is reserved for legacy / imported
--                          rows where we genuinely don't know.
--
--   last_check_at          when the most recent status check fired.
--                          NULL = no check yet (hire-time only).
--
--   last_check_by_user_id  who clicked confirm. References users.
--                          NULL when last_check_at is NULL.
--
--   departure_date         set by the Tier 3 markPlacementDeparted
--                          action. NULL while current_status='active'.
--
--   internal_note          1000-char org-private free-text context.
--                          PII-flagged in audit exports (Phase 9.17
--                          pattern). Never seeker-visible.
--
-- And the new placement_status_checks table, the per-event ledger.

-- ── placements: denormalised lifecycle columns ────────────────────────

CREATE TYPE "placement_lifecycle_status" AS ENUM (
  'active',
  'departed',
  'unknown'
);

ALTER TABLE "placements"
  ADD COLUMN IF NOT EXISTS "current_status" "placement_lifecycle_status" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "last_check_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_check_by_user_id" text REFERENCES "app_user"("id"),
  ADD COLUMN IF NOT EXISTS "departure_date" date,
  ADD COLUMN IF NOT EXISTS "internal_note" text;

-- Hot path: list-page "Active employees" tab + check-in-due cron.
-- Partial index keyed on current_status so a 100% scan of departed
-- rows isn't paid every render. last_check_at NULLS FIRST so rows
-- never checked (the most likely candidates for "due") rank first.
CREATE INDEX IF NOT EXISTS "placements_active_check_due_idx"
  ON "placements" ("organization_id", "last_check_at" NULLS FIRST, "hired_at")
  WHERE "current_status" = 'active';

-- ── placement_status_checks: per-event ledger (Tier 2 ships writes) ──
--
-- Created in this migration per plan D10 even though Tier 1 only
-- reads from it (or rather, doesn't read from it at all). The Tier 2
-- code populates it via confirmPlacementStillEmployed; the empty
-- table sitting around for Tier 1 is harmless and lets each tier ship
-- without a follow-up migration.

CREATE TABLE IF NOT EXISTS "placement_status_checks" (
  "id"                  text PRIMARY KEY,
  "placement_id"        text NOT NULL REFERENCES "placements"("id") ON DELETE CASCADE,
  "checked_by_user_id"  text NOT NULL REFERENCES "app_user"("id"),
  "checked_at"          timestamptz NOT NULL DEFAULT now(),
  -- The single-question outcome of the check-in: are they still
  -- employed in this role? A `false` answer is the path into the
  -- Tier 3 departure capture flow (the form upgrades, the ledger
  -- row remains the event marker).
  "still_employed"      boolean NOT NULL,
  -- Optional 500-char note. PII-flagged the same way invite notes
  -- are (Phase 9.17). Free-form context the recruiter wants to
  -- remember about this specific check; durable org-private notes
  -- live on placements.internal_note instead.
  "note"                text
);

-- Detail-page render: "show every check on this placement, newest
-- first." Single-table scan; placement_id locality wins.
CREATE INDEX IF NOT EXISTS "placement_status_checks_placement_at_idx"
  ON "placement_status_checks" ("placement_id", "checked_at" DESC);
