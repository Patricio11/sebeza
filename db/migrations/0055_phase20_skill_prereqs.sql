-- Phase 20 ("Skill Prerequisites & Sequencing")  a small, admin-curated skill
-- dependency graph: `skill_slug` is best learned AFTER `prereq_skill_slug`.
-- Used to re-order compass recommendations + surface a "Requires: X" pill.
-- Cycle-guarded in the write path; a CHECK blocks the trivial self-loop.
--
-- Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS skill_prereqs (
  skill_slug         text NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
  prereq_skill_slug  text NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
  reason             text NOT NULL,
  created_at         timestamp NOT NULL DEFAULT now(),
  CONSTRAINT skill_prereqs_no_self CHECK (skill_slug <> prereq_skill_slug),
  PRIMARY KEY (skill_slug, prereq_skill_slug)
);

CREATE INDEX IF NOT EXISTS skill_prereqs_prereq_idx
  ON skill_prereqs(prereq_skill_slug);
