-- Phase 9.19 (Tier 2 + Tier 3)  vacancy shortlists + follow-up nudges.
--
-- Two complementary surfaces in one migration:
--
--   vacancy_shortlists       per-(vacancy, profile) bookmark surface
--                            used on /employer/vacancies/[id]/match. Per
--                            D5: scoped to the vacancy, not the user
--                            (two team-mates editing the same vacancy
--                            share one shortlist). Removing is symmetric
--                            to adding; not a consent surface, no audit
--                            kind required.
--
--   vacancies.follow_up_nudges_enabled   per-vacancy opt-in for the
--                            7-days-after-invite gentle reminder cron
--                            (Phase 9.19.3.3). Default false per D8
--                            today no seeker expects a follow-up, so
--                            on-by-default would feel like spam.
--
-- These two surfaces ship in the same migration because they cohabit
-- the same week in Phase 9.19 and would otherwise need two near-empty
-- migrations a day apart. Keep them small + reversible.

-- ── Vacancy shortlists ────────────────────────────────────────────────

-- Phase 12 fix (2026-06-10): added_by_user_id originally referenced
-- "users"("id")  a table that does not exist in this schema (the auth
-- table is "app_user"; see db/schema.ts vacancyShortlists.addedByUserId
-- → appUser.id). Migrate-from-zero in the Phase 12 test harness
-- surfaced the break; databases that ran this file historically carried
-- a legacy "users" relation from early scaffolding.
CREATE TABLE IF NOT EXISTS "vacancy_shortlists" (
  "id"               text PRIMARY KEY,
  "vacancy_id"       text NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE,
  "profile_id"       text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "added_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "added_at"         timestamptz NOT NULL DEFAULT now()
);

-- One row per (vacancy, profile)  upserts on toggle.
CREATE UNIQUE INDEX IF NOT EXISTS "vacancy_shortlists_vacancy_profile_uniq"
  ON "vacancy_shortlists" ("vacancy_id", "profile_id");

-- Lookup-by-vacancy is the hot path (match-page render loads the whole
-- vacancy's shortlist in one go); index covers it.
CREATE INDEX IF NOT EXISTS "vacancy_shortlists_vacancy_idx"
  ON "vacancy_shortlists" ("vacancy_id");

-- ── Follow-up nudges opt-in ───────────────────────────────────────────

ALTER TABLE "vacancies"
  ADD COLUMN IF NOT EXISTS "follow_up_nudges_enabled" boolean NOT NULL DEFAULT false;
