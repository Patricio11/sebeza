-- Phase 9.9  Years-of-experience on the profile + per skill.
--
-- Two additive nullable columns. No data migration  per D1 in
-- PHASE_9_9_PLAN.md, existing rows leave NULLs in place and the
-- value lands when the seeker first edits their profile post-9.9.
-- We deliberately do NOT back-fill from the `experiences` table
-- (lossy; non-contiguous gaps the SQL can't see), and we don't
-- derive years-per-skill from anywhere  it's a self-declared
-- number the seeker controls.
--
-- Range contract (Zod-clamped at the action boundary): 0..60. The
-- DB doesn't enforce the upper bound  treating it as a UI cap
-- keeps the schema simple and lets a hypothetical 70-year-veteran
-- still load via a future migration without dropping a CHECK.
--
-- Public exposure: both fields are CV-header data and ship in the
-- PublicProfile / SkillRef shapes (i.e. visible on /search,
-- /p/[handle], employer dossier). Differs from DOB / gender which
-- are explicitly out of scope here.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "years_experience" integer;

ALTER TABLE "profile_skills"
  ADD COLUMN IF NOT EXISTS "years_of_experience" integer;
