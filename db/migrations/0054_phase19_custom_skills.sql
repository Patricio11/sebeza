-- Phase 19 ("Custom Skills & Taxonomy Growth")  niche skills a seeker claims
-- that aren't in the controlled taxonomy. Self-attested, never verified, and
-- NEVER searchable (no FK to skills, never joined into the search vector). They
-- count toward completeness + feed the admin canonicalization leaderboard, but
-- stay invisible to employer search until an admin promotes the label.
--
-- Idempotent (IF NOT EXISTS throughout).

CREATE TABLE IF NOT EXISTS profile_skills_custom (
  id                  text PRIMARY KEY,
  profile_id          text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- display label as typed (trimmed), max 60 chars (enforced in the action).
  label               text NOT NULL,
  -- lowercased + whitespace-collapsed key for uniqueness + aggregation.
  label_normalized    text NOT NULL,
  proficiency         integer NOT NULL,
  years_of_experience integer,
  created_at          timestamp NOT NULL DEFAULT now(),
  deleted_at          timestamp
);

CREATE INDEX IF NOT EXISTS profile_skills_custom_profile_idx
  ON profile_skills_custom(profile_id);

-- One LIVE custom label per seeker (partial → a removed label can be re-added).
CREATE UNIQUE INDEX IF NOT EXISTS profile_skills_custom_profile_label_uniq
  ON profile_skills_custom(profile_id, label_normalized)
  WHERE deleted_at IS NULL;
