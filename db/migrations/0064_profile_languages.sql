-- Spoken + written languages on seeker profiles
-- (docs/PROFILE_LANGUAGES_PLAN.md).
--
-- Self-declared, plain four-step level per dimension (basic /
-- intermediate / fluent / native). Review-time information for
-- recruiters: never a search gate, never rendered as "verified".
-- Language slugs come from the LANGUAGES constant (12 official
-- languages incl. SASL + common additional languages); the action
-- layer validates + caps at 6 per profile. Counts toward profile
-- completeness (+3 each, capped at +6).
--
-- Idempotent (duplicate_object guard + IF NOT EXISTS).

DO $$ BEGIN
  CREATE TYPE language_level AS ENUM ('basic', 'intermediate', 'fluent', 'native');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS profile_languages (
  profile_id    text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  language_slug text NOT NULL,
  spoken_level  language_level NOT NULL,
  written_level language_level NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_languages_profile_language_uq
  ON profile_languages (profile_id, language_slug);
