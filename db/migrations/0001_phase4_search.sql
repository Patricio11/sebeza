-- Phase 4  Postgres FTS + ranking infrastructure.
--
-- What this migration adds:
--   1. `pg_trgm` extension (typo-tolerant matching for taxonomy labels)
--   2. `profiles.search_vector` switched from text → tsvector
--   3. `sebenza_profile_tsvector(text)` function  composes the vector
--      from profession + seniority + bio + city + province + skill labels
--      with weighted setweight() priorities
--   4. Triggers on `profiles` + `profile_skills` keep the vector fresh on
--      every write (the column is read-only from the app's perspective)
--   5. GIN index on `search_vector` (FTS lookups) + trigram indices on
--      profession / professions.label / skills.label (typo-tolerant) +
--      btree on the common filter columns
--   6. `sebenza_freshness_confidence(timestamp)` SQL function  mirrors
--      `lib/status.ts` confidence weights (1.0 / 0.6 / 0.25) so the
--      ranking SQL and Phase 6 analytics share one source of truth
--   7. Backfill: recompute search_vector for every existing seeded row
--
-- Idempotent  uses IF NOT EXISTS / OR REPLACE everywhere so re-running it
-- against a partially-migrated DB is safe.
--
-- See `docs/PHASE_4_PLAN.md` re-check #2 (trigger-only, no GENERATED column).
-- See `docs/SECURITY.md` for the redaction rules every public query enforces.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Convert profiles.search_vector from text → tsvector
--    The Phase 0 baseline declared it as `text` as a placeholder.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "profiles" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "profiles" ADD COLUMN "search_vector" tsvector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Compose function  single source of truth for a profile's tsvector.
--
-- Weighting (per Postgres ts_rank conventions):
--   A  strongest: profession, aggregated skill labels
--   B  medium:    seniority, location
--   C  weakest:   bio
--
-- We use the `simple` dictionary (no stemming) so e.g. "developer" and
-- "developers" remain distinct matches. Phase 7 may swap in `english` once
-- the taxonomy is settled.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sebenza_profile_tsvector(p_id text)
RETURNS tsvector
LANGUAGE sql
STABLE
AS $$
  SELECT
      setweight(to_tsvector('simple', coalesce(p.profession, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(p.seniority, '')),  'B')
    || setweight(to_tsvector('simple', coalesce(p.bio, '')),        'C')
    || setweight(
         to_tsvector('simple', coalesce(p.city, '') || ' ' || coalesce(p.province, '')),
         'B'
       )
    || setweight(
         to_tsvector('simple', coalesce(
           (SELECT string_agg(s.label, ' ')
              FROM profile_skills ps
              JOIN skills s ON s.slug = ps.skill_slug
             WHERE ps.profile_id = p_id),
           ''
         )),
         'A'
       )
  FROM profiles p
  WHERE p.id = p_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Triggers  keep search_vector fresh on every write.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Profile row changes (profession / seniority / bio / city / province)
CREATE OR REPLACE FUNCTION sebenza_profiles_search_vector_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := sebenza_profile_tsvector(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_search_vector_trigger ON profiles;
CREATE TRIGGER profiles_search_vector_trigger
  BEFORE INSERT OR UPDATE OF profession, seniority, bio, city, province
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sebenza_profiles_search_vector_fn();

-- 4b. Skill-set changes  the aggregation lives in another table so we
--     update the profile's vector from outside.
CREATE OR REPLACE FUNCTION sebenza_profile_skills_search_vector_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_profile_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_profile_id := OLD.profile_id;
  ELSE
    affected_profile_id := NEW.profile_id;
  END IF;

  UPDATE profiles
     SET search_vector = sebenza_profile_tsvector(affected_profile_id)
   WHERE id = affected_profile_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS profile_skills_search_vector_trigger ON profile_skills;
CREATE TRIGGER profile_skills_search_vector_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profile_skills
  FOR EACH ROW
  EXECUTE FUNCTION sebenza_profile_skills_search_vector_fn();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Indices
--
--    - GIN on tsvector for fast `@@` lookups
--    - Trigram on free-text columns (profession + taxonomy labels) for
--      typo tolerance / partial matching
--    - btree on the common filter columns (province, city, status,
--      verification, deleted_at)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS profiles_search_vector_idx
  ON profiles USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS profiles_profession_trgm_idx
  ON profiles USING GIN (profession gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_city_trgm_idx
  ON profiles USING GIN (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_province_idx
  ON profiles (province);

CREATE INDEX IF NOT EXISTS profiles_city_idx
  ON profiles (city);

CREATE INDEX IF NOT EXISTS profiles_status_idx
  ON profiles (status);

CREATE INDEX IF NOT EXISTS profiles_verification_idx
  ON profiles (verification);

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON profiles (deleted_at);

CREATE INDEX IF NOT EXISTS professions_label_trgm_idx
  ON professions USING GIN (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS skills_label_trgm_idx
  ON skills USING GIN (label gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Freshness confidence  SQL mirror of `lib/status.ts`.
--
-- Bands (days since last status confirmation):
--   < 30  → 1.00 fresh
--   < 90  → 0.60 ageing
--   ≥ 90  → 0.25 stale
--
-- Used by the search ranking AND by Phase 6 analytics rollups so both
-- code paths share one definition of "how much do we trust this row".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sebenza_freshness_confidence(confirmed_at timestamp)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN EXTRACT(epoch FROM (now() - confirmed_at)) / 86400 < 30 THEN 1.00
      WHEN EXTRACT(epoch FROM (now() - confirmed_at)) / 86400 < 90 THEN 0.60
      ELSE 0.25
    END;
$$;

-- Overload for timestamptz too  Drizzle's timestamp{withTimezone:true}
-- and timestamp without timezone both appear in our schema, and Postgres
-- won't auto-cast for function dispatch.
CREATE OR REPLACE FUNCTION sebenza_freshness_confidence(confirmed_at timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT sebenza_freshness_confidence(confirmed_at::timestamp);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Backfill  recompute search_vector for every row that already exists.
--    The triggers above will keep it fresh from here on; this populates the
--    seeded data from db/seed.ts.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE profiles SET search_vector = sebenza_profile_tsvector(id);
