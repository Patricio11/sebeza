-- profile_skills: one row per (profile, skill), enforced
-- (docs/GEO_LABEL_CANONICAL_PLAN.md, Compass review 2026-08-27).
--
-- The table shipped in 0000 with two foreign keys and NOTHING else: no
-- primary key, no unique index, not even an index on profile_id. The
-- learning loop's completion step upserts with
-- ON CONFLICT (profile_id, skill_slug), which Postgres refuses (42P10)
-- without a matching unique index, so "Mark complete" has returned 500
-- since Phase 9.12. Duplicates also crept in (the seed wrote one).
--
-- 1. Keep the best row per pair (verified > learning > self-attested,
--    then highest proficiency), delete the rest.
-- 2. Unique index the upsert can infer.
-- 3. Plain index on skill_slug for the skill-expansion / match joins.

WITH ranked AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY profile_id, skill_slug
           ORDER BY CASE provenance
                      WHEN 'verified_provider' THEN 0
                      WHEN 'self_attested_learning' THEN 1
                      WHEN 'imported' THEN 2
                      ELSE 3
                    END,
                    proficiency DESC,
                    verified_at DESC NULLS LAST
         ) AS rn
    FROM profile_skills
)
DELETE FROM profile_skills p
 USING ranked r
 WHERE p.ctid = r.ctid AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profile_skills_profile_skill_uniq
  ON profile_skills (profile_id, skill_slug);

CREATE INDEX IF NOT EXISTS profile_skills_skill_slug_idx
  ON profile_skills (skill_slug);
