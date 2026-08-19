-- 2026-08-19  "Coach's read": AI narrative of the seeker's OWN compass
-- data (no user free-text; coach safety family). Cached per profile so
-- one provider call serves until the underlying data changes.

CREATE TABLE IF NOT EXISTS compass_reads (
  profile_id text PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  headline text NOT NULL,
  body text NOT NULL,
  caveat text NOT NULL,
  model text,
  created_at timestamp NOT NULL DEFAULT now()
);
