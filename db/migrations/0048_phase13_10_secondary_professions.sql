-- Phase 13.10  multi-archetype seeker support.
--
-- Adds `secondary_professions text[]` to `profiles` so a seeker who's
-- worked across multiple professions (e.g. 7 yrs customer service +
-- 2 yrs caregiving + 2 yrs barista + 2 yrs kitchen assistant) can
-- declare all of them. Phase 4's `profiles.profession` single-text
-- field stays the editorial headline; this column carries the
-- additional recognised lanes for the matcher.
--
-- D1 in PHASE_13_10_PLAN.md: secondaries are public (they appear on
-- /p/<handle> as a small chip row under the headline). The PublicProfile
-- type carries them; the redaction rule still excludes IDs / docs /
-- contact -- this column is non-sensitive employment history claim.
--
-- D2: capped at 3 in the application layer (form + server action
-- validation). The DB doesn't enforce the cap; the application is
-- the structural gate (a `CHECK (array_length(secondary_professions,
-- 1) <= 3)` would couple the column to an integer literal and would
-- need to be relaxed if D2 ever loosens).
--
-- D3: only canonical PROFESSIONS.label values written here. No
-- free-text "Other" path -- the Phase 9.15 admin suggestion queue is
-- the route for new professions. Application layer enforces.
--
-- D4: profiles.profession stays a single text label. Secondaries are
-- additive, never replace the headline. Migration is purely additive;
-- existing rows get NOT NULL DEFAULT '{}' so single-profession
-- seekers see zero change.

-- IF NOT EXISTS guards so the migration is safe to re-run against
-- a DB where the schema was already pushed via `drizzle-kit push`.
-- See docs/MIGRATION_JOURNAL_RECOVERY_PLAN.md for context.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS secondary_professions text[] NOT NULL DEFAULT '{}';

-- GIN index for the array-overlap read path in searchProfilesQuery
-- (Task 13.10.5): the widened profession filter becomes
--   WHERE LOWER(p.profession) = LOWER($1)
--      OR LOWER($1) = ANY(SELECT LOWER(unnest(p.secondary_professions)))
-- Without this index the array-side condition forces a sequential
-- scan on every search. Volume on this column is modest (cap 3 per
-- row, ~3 distinct entries on average) so the GIN index is small +
-- the index-vs-seqscan break-even is fast.
CREATE INDEX IF NOT EXISTS idx_profiles_secondary_professions_gin
  ON profiles USING gin (secondary_professions);
