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

CREATE TYPE student_milestone_kind AS ENUM (
  -- Submitted my dissertation / final-year project. Captured because
  -- the academic side rarely surfaces this in time for the
  -- platform to celebrate it auto-derivable.
  'dissertation_submitted',
  -- Graduation date confirmed by the institution. Different from
  -- expectedGraduation (which is intent at sign-up); this is the
  -- moment the date became real.
  'graduation_confirmed',
  -- First job offer accepted. Bridges the gap before an employer
  -- Mark-as-Hired flows (which may or may not happen on Sebenza).
  'first_job_accepted',
  -- The student left the formal academic system without a
  -- credential. Captured honestly because the alternative is the
  -- profile staying "Year 3" forever; the platform doesn't pretend
  -- the student is still in school.
  'studies_paused',
  -- Generic milestone for things the kind enum doesn't cover.
  -- The note field carries the detail.
  'other'
);

CREATE TABLE student_milestones (
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
CREATE UNIQUE INDEX student_milestones_one_shot_uq
  ON student_milestones(profile_id, kind)
  WHERE kind <> 'other';

-- Lookup by profile for the timeline read path.
CREATE INDEX idx_student_milestones_by_profile
  ON student_milestones(profile_id);
