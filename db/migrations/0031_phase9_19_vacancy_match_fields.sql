-- Phase 9.19 (Tier 1)  enrich the vacancy schema for sharper matching.
--
-- The Phase 9.8 match query reads only profession + skills + province +
-- city + seniority off the vacancy. Meanwhile the seeker side captures
-- work availability (Phase 9.18: full_time / part_time / contract /
-- casual / remote / hybrid), total years of experience (Phase 9.9), and
-- NQF level on academic profiles  none of which the matcher could
-- consult because the vacancy didn't ask. This migration adds the three
-- vacancy-side fields that close that gap.
--
-- Columns:
--
--   work_availability       array of `work_availability_kind` values
--                            the role offers. Empty array = the
--                            vacancy doesn't constrain on this axis
--                            (current behaviour stays unchanged).
--
--   min_years_experience    integer minimum total years required.
--                            NULL = "any."
--
--   min_nqf_level           integer minimum NQF level (1-10) required.
--                            NULL = "any." Matches against the
--                            seeker's highest `academic_profiles.nqf_level`.
--
-- All three are nullable / empty-by-default so existing vacancies stay
-- valid post-migration and behave as before until an organiser
-- explicitly edits them.

ALTER TABLE "vacancies"
  ADD COLUMN IF NOT EXISTS "work_availability" "work_availability_kind"[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "min_years_experience" int,
  ADD COLUMN IF NOT EXISTS "min_nqf_level" int;

-- Partial index for the years-experience filter: only vacancies that
-- actually constrain on years benefit from the scan; the rest fall
-- through cheaply via the NULL short-circuit in the query layer.
CREATE INDEX IF NOT EXISTS "vacancies_min_years_idx"
  ON "vacancies" ("min_years_experience")
  WHERE "min_years_experience" IS NOT NULL;
