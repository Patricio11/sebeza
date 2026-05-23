-- Phase 7.5 — Work-availability dimension + placement source split.
--
-- New axis on profiles, decoupled from employment_status: a `studying`
-- person can signal `casual`; a `full_time` employee can signal
-- `contract`. Status answers "what's your situation"; availability
-- answers "what work will you take."
--
-- Also splits the placements source so seeker self-reports can exist
-- without contaminating official analytics (Placement-Truth Rule).
--
-- Schema is re-runnable. Enum extensions land in 0008_*.sql so this
-- file stays a pure additive set (no ALTER TYPE inside a transaction).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. work_availability_kind enum + profiles.work_availability column
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_availability_kind') THEN
    CREATE TYPE "work_availability_kind" AS ENUM (
      'casual',
      'part_time',
      'contract',
      'full_time'
    );
  END IF;
END$$;

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "work_availability" work_availability_kind[]
  NOT NULL DEFAULT '{}'::work_availability_kind[];

-- GIN index supports `&&` (overlaps) + `@>` (contains) array predicates
-- — the shape `searchProfilesQuery` uses for multi-select filters.
CREATE INDEX IF NOT EXISTS profiles_work_availability_gin_idx
  ON profiles USING GIN (work_availability);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. placement_source enum + placements.source column
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'placement_source') THEN
    CREATE TYPE "placement_source" AS ENUM (
      'employer_confirmed',
      'seeker_reported'
    );
  END IF;
END$$;

ALTER TABLE "placements"
  ADD COLUMN IF NOT EXISTS "source" placement_source
  NOT NULL DEFAULT 'employer_confirmed';

-- The analytics queries filter on source='employer_confirmed' constantly;
-- partial index keeps the hot path cheap.
CREATE INDEX IF NOT EXISTS placements_employer_confirmed_idx
  ON placements (organization_id, hired_at DESC)
  WHERE source = 'employer_confirmed';
