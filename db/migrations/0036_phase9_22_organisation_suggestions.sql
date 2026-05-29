-- Phase 9.22  organisation suggestions + seeker current-employment.
--
-- Extends the Phase 9.15 taxonomy_suggestions machinery to a third
-- kind ('organisation'), adds an `origin` axis on organizations so
-- the picker can tell Sebenza-recruiting employers apart from
-- seeker-named ones, and adds three nullable current-employment
-- columns on profiles so the seeker can declare where they work
-- when status is `employed` or `self_employed`.
--
-- Postgres requires `ALTER TYPE ... ADD VALUE` to run outside a
-- transaction block; drizzle-kit migrate handles each file as its
-- own transaction.
--
-- Design notes:
--
-- Reusing existing `verification` column for the seeker-named
-- lifecycle (instead of a parallel review_state column): a
-- seeker_named row's lifecycle is `unverified` (just submitted) ->
-- `verified` (admin approved) or `rejected` (admin rejected). The
-- `pending` value stays reserved for Phase 9.10 KYC docs submitted.
-- Origin disambiguates the two semantics; the picker filter is
-- `WHERE origin = 'sebenza_registered' OR verification = 'verified'`
-- and a rejected row never surfaces.
--
-- The `listed_by_seeker_count` denormalised column powers the
-- "Listed by N seekers" badge on verified seeker-named orgs without
-- a per-render JOIN to profiles.

-- ── taxonomy_suggestion_kind: add 'organisation' ─────────────────────

ALTER TYPE "taxonomy_suggestion_kind" ADD VALUE IF NOT EXISTS 'organisation';

-- ── organizations: origin axis + denormalised seeker count ───────────

CREATE TYPE "organization_origin" AS ENUM (
  'sebenza_registered',
  'seeker_named'
);

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "origin" "organization_origin" NOT NULL DEFAULT 'sebenza_registered',
  ADD COLUMN IF NOT EXISTS "listed_by_seeker_count" int NOT NULL DEFAULT 0;

-- Picker hot path: combobox over verified orgs across both origins.
-- The composite covers the (origin, verification, name) read pattern.
-- `WHERE verification != 'rejected'` keeps the index slim - rejected
-- rows are kept for audit (Phase 9.15 D2: never mutate user data) but
-- never picker-visible.
CREATE INDEX IF NOT EXISTS "organizations_picker_idx"
  ON "organizations" ("origin", "verification", "name")
  WHERE "verification" != 'rejected';

-- ── taxonomy_suggestions: pending org linkage ────────────────────────
--
-- Mirror of pending_institution_slug for the org-kind branch. NULL for
-- profession + institution kinds. Set at submit time so the admin
-- promote/merge/reject paths can clean up the pending row.

ALTER TABLE "taxonomy_suggestions"
  ADD COLUMN IF NOT EXISTS "pending_organisation_id" text
    REFERENCES "organizations"("id") ON DELETE SET NULL;

-- ── profiles: current employment ─────────────────────────────────────
--
-- All three are nullable. NULL on current_employer_org_id means the
-- seeker hasn't declared where they work (or never picked from the
-- picker - their employer might be in the pending state, in which
-- case the seeker's profile still surfaces the free-text from the
-- suggestion row, not a verified FK).
--
-- Day-precision on start date keeps things flexible even though the
-- form captures year + month (day defaults to 01).
--
-- current_role_city can diverge from profiles.city for seekers who
-- live in Joburg but commute to Pretoria, etc. Falls back to
-- profiles.city in the public renderer when NULL.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "current_employer_org_id" text
    REFERENCES "organizations"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "current_role_started_at" date,
  ADD COLUMN IF NOT EXISTS "current_role_city" text;

-- Search hot path: "show me everyone working at org X" - employer
-- diligence + admin queue + the "Listed by N seekers" denormalised
-- count maintenance all need this.
CREATE INDEX IF NOT EXISTS "profiles_current_employer_idx"
  ON "profiles" ("current_employer_org_id")
  WHERE "current_employer_org_id" IS NOT NULL;
