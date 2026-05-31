-- Phase 11.5  profile depth.
--
-- Two additive column groups on `profiles`:
--
--   1. open_to_tags             (Task 11.5.1)  voluntary "open to"
--                               array (mentorship / freelance /
--                               contract_gigs / public_speaking).
--                               GIN-indexed for `&&` filter on /search.
--
--   2. cv_storage_key + cv_*    (Task 11.5.2)  personal CV backup.
--                               Private to the seeker; never exposed
--                               to employers (D3). Storage object
--                               lives in the Supabase private bucket
--                               under `{userId}/cvs/{id}.pdf`.
--
-- Both default to NULL / empty so existing rows are unchanged.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS open_to_tags     text[]     NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cv_storage_key   text,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at   timestamp,
  ADD COLUMN IF NOT EXISTS cv_filename      text;

-- GIN index for the `&&` array overlap operator used by the new
-- `open_to` search filter (Task 11.5.1).
CREATE INDEX IF NOT EXISTS idx_profiles_open_to_tags
  ON profiles USING GIN (open_to_tags);
