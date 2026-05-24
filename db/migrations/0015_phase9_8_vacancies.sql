-- Phase 9.8.1  Vacancies & demand-driven matching foundation.
--
-- Creates the vacancy_status enum + the vacancies table + adds a
-- nullable vacancy_id FK to placements so a placement can be linked
-- to a vacancy (1:0..N relationship) without breaking the pre-9.8
-- placement flow (placement.vacancy_id = NULL is fully valid).
--
-- Privacy invariant (enforced by lib/employer/vacancies.ts + 9.8.8
-- compliance assertion (a)): no vacancy field is exposed on any
-- public route, /p/[handle], /search, sitemap, or to a non-member
-- of the owning organization. Salary band stays private  consistent
-- with the Phase 5 placements.salary_band rule.
--
-- ON DELETE CASCADE for vacancies.organization_id means a deleted org
-- (rare; tombstone path) takes its vacancies with it. ON DELETE SET
-- NULL for placements.vacancy_id means deleting a vacancy never
-- breaks Placement-Truth history  the placement stays in the
-- analytics; its origin is just no longer recoverable.

CREATE TYPE "vacancy_status" AS ENUM ('draft', 'open', 'closed', 'filled');

CREATE TABLE IF NOT EXISTS "vacancies" (
  "id"                   text PRIMARY KEY NOT NULL,
  "organization_id"      text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by_user_id"   text NOT NULL REFERENCES "app_user"("id"),
  "title"                text NOT NULL,
  "profession_slug"      text NOT NULL REFERENCES "professions"("slug"),
  "province_slug"        text NOT NULL REFERENCES "provinces"("slug"),
  "city_slug"            text REFERENCES "cities"("slug"),
  "skill_slugs"          text[] NOT NULL DEFAULT '{}',
  "seniority"            text,
  "salary_band"          text,
  "description"          text,
  "documents_required"   text[] NOT NULL DEFAULT '{}',
  "status"               "vacancy_status" NOT NULL DEFAULT 'draft',
  "invite_expiry_days"   integer,
  "created_at"           timestamp NOT NULL DEFAULT now(),
  "closed_at"            timestamp
);

CREATE INDEX IF NOT EXISTS "vacancies_org_status_idx"
  ON "vacancies" ("organization_id", "status");

ALTER TABLE "placements"
  ADD COLUMN IF NOT EXISTS "vacancy_id" text
  REFERENCES "vacancies"("id") ON DELETE SET NULL;
