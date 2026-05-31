-- Phase 13.2  module_skills catalogue.
--
-- Mirror of `programme_skills` at the module-level granularity. The
-- editorial pipeline in Task 13.3 populates the rows; the read path
-- in `db/queries/curriculum.ts` fuzzy-matches the student's
-- `academic_profiles.current_modules` strings against `module_label`
-- via `pg_trgm` similarity.
--
-- Differences from `programme_skills`:
--
--   1. Carries per-row provenance (source, approved_by, approved_at,
--      confidence). Editorial rows have source='editorial' + the
--      admin user id; LLM-suggested rows from Task 13.3 land as
--      source='llm_suggested' + NULL approver until an admin reviews
--      them.
--
--   2. Optional `institution_slug` lets editors curate per-institution
--      mappings (Wits "Database Systems" deeply teaches PostgreSQL;
--      UCT's "Databases" leans towards MongoDB). NULL = canonical
--      cross-institution. The read path prefers institution-scoped
--      rows when both exist.
--
--   3. Explicit `id text PRIMARY KEY` instead of programme_skills'
--      composite key  the provenance metadata reads more naturally
--      against a stable row id.
--
-- pg_trgm extension is already enabled in migration 0001 (Phase 4
-- search). No CREATE EXTENSION needed here.

-- Provenance of a module_skills row.
--
--   editorial       admin curated by hand. The trusted-by-default
--                   source. approved_by + approved_at always set.
--
--   llm_suggested   Task 13.3 pipeline output. approved_by + at NULL
--                   until an admin reviews. Read path EXCLUDES these
--                   rows by default; they appear only on the admin
--                   review queue.
--
--   student_signal  reserved. Future enhancement: when many students
--                   in the same programme declare the same module
--                   string + a recommendation later proves out, the
--                   platform suggests the mapping to the editorial
--                   pipeline. Not yet wired; the enum value is
--                   reserved so we don't have to migrate later.
CREATE TYPE module_skill_source AS ENUM (
  'editorial',
  'llm_suggested',
  'student_signal'
);

CREATE TABLE module_skills (
  id               text PRIMARY KEY,
  -- Lowercase slug + the original display label. Trigram match runs
  -- on `module_label`; the slug is the canonical key for the unique
  -- constraints below + for stable references from audit rows.
  module_slug      text NOT NULL,
  module_label     text NOT NULL,
  skill_slug       text NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
  -- 1..5 editorial confidence. Influences ranking on the card render
  -- + acts as a tiebreaker when multiple rows match the same module.
  confidence       smallint NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  source           module_skill_source NOT NULL,
  approved_by      text REFERENCES app_user(id) ON DELETE SET NULL,
  approved_at      timestamp,
  -- NULL = canonical cross-institution mapping. When set, the row
  -- only applies for the named institution; the read path prefers
  -- institution rows over canonical rows when both exist.
  institution_slug text REFERENCES institutions(slug),
  created_at       timestamp NOT NULL DEFAULT now()
);

-- Two-partial-index pattern for the at-most-one-row-per-cell
-- constraint. Postgres treats NULL as distinct in a normal UNIQUE
-- constraint, which would let us silently double-insert canonical
-- (module, skill, NULL) rows. The partial indexes enforce the
-- right invariant on each branch:
--
--   * institution_slug IS NULL    -> unique on (module_slug, skill_slug)
--   * institution_slug IS NOT NULL -> unique on (module_slug, skill_slug, institution_slug)
CREATE UNIQUE INDEX module_skills_canonical_uq
  ON module_skills(module_slug, skill_slug)
  WHERE institution_slug IS NULL;

CREATE UNIQUE INDEX module_skills_institution_uq
  ON module_skills(module_slug, skill_slug, institution_slug)
  WHERE institution_slug IS NOT NULL;

-- Lookup by module_slug (the canonical key used by the cached read
-- path after the student's free-text input gets slug-normalised).
CREATE INDEX idx_module_skills_by_module
  ON module_skills(module_slug);

-- Lookup by skill_slug (the gov-side analytics in Task 13.6 will
-- aggregate by skill: "which modules teach SQL across SA?").
CREATE INDEX idx_module_skills_by_skill
  ON module_skills(skill_slug);

-- Trigram GIN index on module_label for the student-side fuzzy
-- match. The read path runs:
--
--   SELECT ... FROM module_skills
--   WHERE module_label % $1   -- pg_trgm operator: similarity > pg_trgm.similarity_threshold
--
-- This index makes that query a cheap GIN scan instead of a full
-- table scan. Editorial catalogue volume will stay modest
-- (thousands of rows) so the index is not strictly required, but
-- it future-proofs the read path for Tier-2 expansion.
CREATE INDEX idx_module_skills_label_trgm
  ON module_skills USING GIN (module_label gin_trgm_ops);
