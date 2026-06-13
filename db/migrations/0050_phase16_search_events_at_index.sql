-- Phase 16  index search_events by time.
--
-- Every demand read prunes by a trailing window (`at >= now() - interval`):
-- the career-compass demand engine, getNearYouDemand (the "Work near you"
-- card), and the skills-gap analytics. `search_events` carried only its
-- pkey, so each of those was a full scan. A btree on `at` turns them into
-- range scans  cheap insurance at national search volume.
--
-- Additive + idempotent (journal-recovery convention).

CREATE INDEX IF NOT EXISTS "search_events_at_idx"
  ON "search_events" ("at");
