-- Phase 6.5  time-series snapshots for the skills-gap engine.
--
-- Each row is one entry in a top-N gap snapshot. Comparing two captures
-- by `captured_at` (e.g. yesterday vs 8 days ago) produces the week-over-week
-- delta arrows on `/insights`.
--
-- Province scope: NULL = national snapshot, otherwise the lowercased
-- province label. Future captures can interleave national + per-province
-- runs without schema changes.

CREATE TABLE IF NOT EXISTS "skill_gap_snapshots" (
  "id"            text PRIMARY KEY,
  "captured_at"   timestamp NOT NULL DEFAULT now(),
  "skill"         text NOT NULL,
  "searches"      integer NOT NULL,
  "matches"       integer NOT NULL,
  "fresh_matches" text NOT NULL,        -- numeric stored as text for round-trip safety
  "gap"           integer NOT NULL,
  "province"      text                  -- NULL = national
);

CREATE INDEX IF NOT EXISTS skill_gap_snapshots_captured_at_idx
  ON skill_gap_snapshots (captured_at DESC);

-- Lookup pattern for the trend query: "give me all rows for skill X across captures".
CREATE INDEX IF NOT EXISTS skill_gap_snapshots_skill_captured_at_idx
  ON skill_gap_snapshots (skill, captured_at DESC);
