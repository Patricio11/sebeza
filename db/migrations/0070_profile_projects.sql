-- 2026-08-19  "Work & projects" on the seeker profile
-- (docs/PROFILE_PROJECTS_PLAN.md). A link and/or up to 5 images, each
-- with the seeker's own contribution note. Self-declared by design;
-- deliberately NOT part of completeness or ranking.

CREATE TABLE IF NOT EXISTS profile_projects (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  -- Nullable: photo-only projects (an artisan's finished job) are
  -- first-class, not a lesser case.
  url text,
  contribution text NOT NULL,
  year integer,
  skill_slugs text[] NOT NULL DEFAULT '{}'::text[],
  -- WebP object keys from the shared upload pipeline (max 5, enforced
  -- in the action layer). Each has a derived `.thumb.webp` sibling.
  image_keys text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_projects_profile_idx
  ON profile_projects (profile_id, sort_order);
