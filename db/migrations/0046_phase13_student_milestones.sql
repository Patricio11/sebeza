-- Phase 13.4  student_milestones  self-declared events on the
-- <StudentProgressionTimeline> surface.
--
-- The progression timeline composes four data sources:
--
--   1. academic_profiles.currentYear + expectedGraduation
--      → "Year 2 of 4, ~18 months to graduation"
--   2. qualifications (auto-derived)
--      → "BSc Computer Science  University of the Witwatersrand"
--         with the existing verification enum as a status chip.
--   3. placements (auto-derived)
--      → "Internship at Yoco confirmed Jan 2027" via hiredAt.
--   4. learning_items.state='completed' (auto-derived)
--      → "Completed: SQL Fundamentals" via completedAt.
--
-- The first four are AUTO-DERIVED  no new column, no new write.
-- This table covers the FIFTH source: milestones the platform
-- can't see by itself. The student declares them with a kind +
-- a date + optional one-line note. Rendered alongside the
-- auto-derived rows, with a small "Self-declared" provenance chip
-- so the student sees how the platform knows what it knows (D6 in
-- the Phase 13 plan).
--
-- Honesty contract:
--
--   * self-declared milestones never appear on the PUBLIC profile.
--     This table is for the private /dashboard/grow surface only.
--   * the Verification-Honesty Rule still holds: a self-declared
--     "first_job_accepted" milestone does NOT flip placements to
--     employer_confirmed. Only employer Mark-as-Hired does that.

-- IF-NOT-EXISTS guards added retroactively
-- (docs/MIGRATION_JOURNAL_RECOVERY_PLAN.md).
DO $$ BEGIN
  CREATE TYPE student_milestone_kind AS ENUM (
    'dissertation_submitted',
    'graduation_confirmed',
    'first_job_accepted',
    'studies_paused',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS student_milestones (
  id          text PRIMARY KEY,
  profile_id  text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        student_milestone_kind NOT NULL,
  occurred_on date NOT NULL,
  -- Optional one-line context. Visible only on the private
  -- /dashboard/grow surface; never surfaces on /p/<handle>.
  -- Cap at 200 chars matches Phase 13.1 project_topic.
  note        text,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- One row per (profile, kind) for the kinds that are inherently
-- one-shot (dissertation_submitted, graduation_confirmed,
-- first_job_accepted, studies_paused). The 'other' kind can repeat.
-- Partial unique index enforces the constraint without blocking
-- the 'other' kind.
CREATE UNIQUE INDEX IF NOT EXISTS student_milestones_one_shot_uq
  ON student_milestones(profile_id, kind)
  WHERE kind <> 'other';

-- Lookup by profile for the timeline read path.
CREATE INDEX IF NOT EXISTS idx_student_milestones_by_profile
  ON student_milestones(profile_id);
