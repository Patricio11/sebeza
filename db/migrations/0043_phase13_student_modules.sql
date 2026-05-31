-- Phase 13.1  student module / elective / project capture.
--
-- Three additive columns on `academic_profiles`. All optional; the
-- programme + field_of_study baseline still works for students who
-- skip these. The matcher upgrades only when one or more of these
-- are filled in.
--
--   1. current_modules text[]   modules the student is currently
--                                doing. Free text + trigram fuzzy
--                                match against the `module_skills`
--                                catalogue (lands in Task 13.2).
--                                GIN-indexed for the same `&&`
--                                overlap operator used elsewhere.
--
--   2. elective_chosen text    single elective they picked when they
--                                had options. Surfaced from year 2.
--
--   3. project_topic text      3rd/4th-year project / dissertation
--                                topic. Strongest single skill signal
--                                we can capture. 200-char cap at the
--                                action boundary.
--
-- D1 invariant: all three are optional. No re-validation flow; no
-- effect on `academic_profiles.verification`. These describe the
-- student's CURRENT context, not their credential, so editing them
-- never re-opens SAQA review.

ALTER TABLE academic_profiles
  ADD COLUMN IF NOT EXISTS current_modules text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS elective_chosen text,
  ADD COLUMN IF NOT EXISTS project_topic   text;

-- GIN index for the `&&` array overlap operator used by the Task 13.2
-- module_skills read path + by the future cross-cohort analytics on
-- module prevalence. Same pattern as the Phase 11.5.1
-- `profiles.open_to_tags` GIN index.
CREATE INDEX IF NOT EXISTS idx_academic_profiles_current_modules
  ON academic_profiles USING GIN (current_modules);
