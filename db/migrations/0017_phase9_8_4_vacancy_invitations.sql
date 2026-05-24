-- Phase 9.8.4  Vacancy invitations (bulk-invite + lifecycle).
--
-- Creates:
--   1. `invitation_state` enum   the seven lifecycle states from D1+D2.
--   2. `decline_reason` enum     six work-related reasons + `other` per D3.
--      (Shipped here, used by 9.8.5's seeker-facing response action.)
--   3. `vacancy_invitations` table  persistent (vacancy × seeker) pipeline
--      rows. Opposite of saved-search semantics (`searchSnapshot ≠ result-
--      set`)  here the membership IS the artefact.
--
-- Privacy invariant (enforced by lib/employer/invitations.ts + 9.8.8
-- compliance assertion (a)): every read scopes by the parent vacancy's
-- organization or by the caller's own profileId. Cross-seeker / cross-
-- org leakage is structurally impossible.
--
-- Consent gate (asserted by 9.8.8 check (b)): a row is only ever
-- written when the seeker had `vacancy_matching` consent in
-- `state='granted'` at write time. The bulk-invite Server Action calls
-- `hasVacancyMatchingConsent()` per seeker and routes non-consented
-- seekers to the audit log with reason=`consent_not_granted` (UI shows
-- only the soft summary, per D5).
--
-- Cascade rules:
--   - vacancy_invitations.vacancy_id  ON DELETE CASCADE: a deleted
--     vacancy takes its invitations with it (no orphaned pipeline rows).
--   - vacancy_invitations.profile_id  ON DELETE CASCADE: a deleted
--     profile (POPIA §24 hard-delete) takes its invitations too.
--
-- Indexes:
--   - UNIQUE (vacancy_id, profile_id): one invite per (vacancy, person);
--     re-inviting is a no-op surfaced as `already_invited` skip reason
--     in the audit log.
--   - (vacancy_id, state): employer detail page  pipeline grouped by state.
--   - (profile_id, state): seeker inbox  invitations grouped by state.
--   - (expires_at): cron range scan for `state='invited' AND expires_at <
--     now()`.

CREATE TYPE "invitation_state" AS ENUM (
  'invited',
  'accepted',
  'accepted_with_notice',
  'declined',
  'reconsidering',
  'withdrawn',
  'expired'
);

CREATE TYPE "decline_reason" AS ENUM (
  'already_employed',
  'salary_not_competitive',
  'location_not_feasible',
  'skills_mismatch',
  'role_not_what_im_looking_for',
  'other'
);

CREATE TABLE IF NOT EXISTS "vacancy_invitations" (
  "id"                     text PRIMARY KEY NOT NULL,
  "vacancy_id"             text NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE,
  "profile_id"             text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "invited_by_user_id"     text NOT NULL REFERENCES "app_user"("id"),
  "invited_at"             timestamp NOT NULL DEFAULT now(),
  "expires_at"             timestamp,
  "state"                  "invitation_state" NOT NULL DEFAULT 'invited',
  "responded_at"           timestamp,
  "notice_period_months"   integer,
  "decline_reason"         "decline_reason",
  "decline_note"           text
);

CREATE UNIQUE INDEX IF NOT EXISTS "vacancy_invitations_vacancy_profile_uq"
  ON "vacancy_invitations" ("vacancy_id", "profile_id");

CREATE INDEX IF NOT EXISTS "vacancy_invitations_vacancy_state_idx"
  ON "vacancy_invitations" ("vacancy_id", "state");

CREATE INDEX IF NOT EXISTS "vacancy_invitations_profile_state_idx"
  ON "vacancy_invitations" ("profile_id", "state");

CREATE INDEX IF NOT EXISTS "vacancy_invitations_expires_at_idx"
  ON "vacancy_invitations" ("expires_at");
