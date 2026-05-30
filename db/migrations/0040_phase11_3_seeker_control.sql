-- Phase 11.3  seeker control + trust posture.
--
-- Bundles four additive schema changes that together unlock the
-- agency surfaces for Phase 11.3. Each section is independently
-- idempotent; rerun-safe.
--
--   1. Pause-searchability columns on `consents`            (Task 11.3.1)
--   2. New `seeker_blocked_employers` table                  (Task 11.3.2)
--   3. Report-this-invite enum additions + report columns    (Task 11.3.3)
--   4. Vacancy snapshot column on `vacancy_invitations`      (Task 11.3.4)
--
-- Tasks 11.3.5 + 11.3.6 are UI-only  no DDL needed.

-- ──────────────────────────────────────────────────────────────────────
-- 1. PAUSE SEARCHABILITY  three nullable columns on `consents`.
--    `paused_until` is the canonical pause signal; a row with
--    `state='granted'` AND `paused_until > now()` is paused. The cron
--    sweeps expired pauses nightly. `paused_at` + `paused_reason` are
--    historical context for the audit trail.
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE consents
  ADD COLUMN IF NOT EXISTS paused_until  timestamp,
  ADD COLUMN IF NOT EXISTS paused_at     timestamp,
  ADD COLUMN IF NOT EXISTS paused_reason text;

-- ──────────────────────────────────────────────────────────────────────
-- 2. SEEKER BLOCKED EMPLOYERS  private-to-seeker block list.
--    Employer NEVER reads from this table (privacy invariant D2);
--    only the seeker's surface + the search/invite enforcement read.
--    UNIQUE constraint dedupes per (profile, org).
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seeker_blocked_employers (
  id          text PRIMARY KEY,
  profile_id  text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blocked_at  timestamp NOT NULL DEFAULT now(),
  reason      text,
  UNIQUE (profile_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_employers_by_profile
  ON seeker_blocked_employers(profile_id);

CREATE INDEX IF NOT EXISTS idx_blocked_employers_by_org
  ON seeker_blocked_employers(org_id);

-- ──────────────────────────────────────────────────────────────────────
-- 3. REPORT THIS INVITE  three new enum values + two new columns on
--    the existing `reports` table. `subject_org_id` + `subject_invitation_id`
--    are nullable: the table still serves the original "report a
--    profile" path (existing `subject_profile_id`). The new columns
--    extend the table to also support "report an invitation".
-- ──────────────────────────────────────────────────────────────────────

ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'irrelevant_role';
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'bad_faith_company';
ALTER TYPE report_reason ADD VALUE IF NOT EXISTS 'off_platform_contact_request';

ALTER TABLE reports
  ALTER COLUMN subject_profile_id DROP NOT NULL;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS subject_org_id        text REFERENCES organizations(id)        ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_invitation_id text REFERENCES vacancy_invitations(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_by_org        ON reports(subject_org_id);
CREATE INDEX IF NOT EXISTS idx_reports_by_invitation ON reports(subject_invitation_id);

-- ──────────────────────────────────────────────────────────────────────
-- 4. VACANCY SNAPSHOT  frozen-at-send-time spec on the invitation
--    row. The seeker sees what the employer published when they sent
--    the invite, even if the vacancy is later edited. Pre-existing
--    invitations have NULL; the UI falls back to live-querying the
--    vacancy with a "may have changed" annotation.
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE vacancy_invitations
  ADD COLUMN IF NOT EXISTS vacancy_snapshot jsonb;
