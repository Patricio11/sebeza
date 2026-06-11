-- Phase 12 — schema-drift capture (2026-06-10).
--
-- The Phase 12 migrate-from-zero test harness compared a journal-built
-- database against `db/schema.ts` (via drizzle-kit push on a disposable
-- copy + pg_dump diff). Two changes had landed in schema.ts via
-- `drizzle-kit push` during the "Hiring UX polish" pass (2026-05-30)
-- without a migration file, so databases built from the journal alone
-- (fresh dev environments, the test harness, the future AWS cutover
-- restore-check) were missing them:
--
--   1. `taxonomy_suggestion_kind` enum value 'skill' — the skill
--      "Other" path on the profile editor + vacancy form submits
--      suggestions with kind='skill' into the admin queue.
--
--   2. `vacancies.seasonal_window_start_year` / `_end_year` — optional
--      anchor years for the Phase 9.21 seasonal window (a Dec→Feb
--      harvest window needs the year pair to disambiguate the wrap).
--
-- Existing databases that received these via push are unaffected:
-- both statements are IF-NOT-EXISTS idempotent per the journal-recovery
-- convention (docs/completed/MIGRATION_JOURNAL_RECOVERY_PLAN.md).

ALTER TYPE "taxonomy_suggestion_kind" ADD VALUE IF NOT EXISTS 'skill';

ALTER TABLE "vacancies"
  ADD COLUMN IF NOT EXISTS "seasonal_window_start_year" integer,
  ADD COLUMN IF NOT EXISTS "seasonal_window_end_year"   integer;
