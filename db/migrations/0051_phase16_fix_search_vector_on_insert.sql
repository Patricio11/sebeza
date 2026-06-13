-- Phase 16 follow-up  FIX: profiles with no skills were invisible in search.
--
-- BUG (latent since Phase 4): the profiles search-vector trigger fired
-- BEFORE INSERT and computed the vector via
-- `sebenza_profile_tsvector(NEW.id)`  which does `SELECT … FROM profiles
-- WHERE id = NEW.id`. During BEFORE INSERT the row does not exist yet, so
-- that lookup returns no row and the function returns NULL. The vector was
-- therefore set to NULL on every insert, and only ever populated later as a
-- side effect of the `profile_skills` AFTER trigger (which rebuilds it when a
-- skill is added). Net effect: ANY profile with zero skills had a NULL
-- search_vector and never matched `@@ websearch_to_tsquery(...)`  i.e. was
-- completely absent from national search + employer vacancy-matching, even
-- by profession. (Surfaced while seeding/verifying the Phase 16 "near you"
-- work: the 12-person synthetic Wits BSc CS cohort, who carry no skills, were
-- unreachable in search/match.)
--
-- FIX: build the vector from the NEW row's own columns (available in BEFORE
-- INSERT) instead of re-reading the not-yet-inserted row. The skills
-- contribution still comes from a sub-select over profile_skills (empty at
-- insert time, then kept fresh by the existing profile_skills AFTER trigger).
-- Weights are unchanged (profession A · seniority B · bio C · city+province B
-- · skills A), so ranking is identical for profiles that already had a vector.
--
-- Idempotent: CREATE OR REPLACE + a guarded backfill.

CREATE OR REPLACE FUNCTION sebenza_profiles_search_vector_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
       setweight(to_tsvector('simple', coalesce(NEW.profession, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(NEW.seniority, '')),  'B')
    || setweight(to_tsvector('simple', coalesce(NEW.bio, '')),        'C')
    || setweight(
         to_tsvector('simple', coalesce(NEW.city, '') || ' ' || coalesce(NEW.province, '')),
         'B'
       )
    || setweight(
         to_tsvector('simple', coalesce(
           (SELECT string_agg(s.label, ' ')
              FROM profile_skills ps
              JOIN skills s ON s.slug = ps.skill_slug
             WHERE ps.profile_id = NEW.id),
           ''
         )),
         'A'
       );
  RETURN NEW;
END;
$$;

-- Backfill every row that the old INSERT path left NULL. The row exists now,
-- so the original by-id helper computes the full vector correctly.
UPDATE profiles
   SET search_vector = sebenza_profile_tsvector(id)
 WHERE search_vector IS NULL;
