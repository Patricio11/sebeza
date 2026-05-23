-- Phase 5  Employer portal: reveal flow, placements, saved searches, shortlists.
--
-- 1. `placements.actor_user_id` + `placements.salary_band` (new cols on
--    an existing table  both nullable so seeded rows survive).
-- 2. `saved_searches`  per-org saved-search definitions.
-- 3. `shortlist_pools` + `shortlist_members`  per-org talent pools.
--
-- See `docs/PHASE_5_PLAN.md` for the rationale on each table.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend placements
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "placements"
  ADD COLUMN IF NOT EXISTS "actor_user_id" text REFERENCES "app_user"("id");

ALTER TABLE "placements"
  ADD COLUMN IF NOT EXISTS "salary_band" text;

CREATE INDEX IF NOT EXISTS placements_org_idx ON placements (organization_id);
CREATE INDEX IF NOT EXISTS placements_profile_idx ON placements (profile_id);
CREATE INDEX IF NOT EXISTS placements_hired_at_idx ON placements (hired_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Saved searches
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "name" text NOT NULL,
  "filters" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "last_run_at" timestamp,
  "new_matches_count" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS saved_searches_org_idx
  ON saved_searches (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Shortlist pools + members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "shortlist_pools" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shortlist_pools_org_idx
  ON shortlist_pools (organization_id);

CREATE TABLE IF NOT EXISTS "shortlist_members" (
  "pool_id" text NOT NULL REFERENCES "shortlist_pools"("id") ON DELETE CASCADE,
  "profile_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "added_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "added_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("pool_id", "profile_id")
);

CREATE INDEX IF NOT EXISTS shortlist_members_profile_idx
  ON shortlist_members (profile_id);
