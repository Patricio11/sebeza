-- Phase 34 ("Self Apply")  public vacancy link + seeker-initiated
-- applications (docs/PHASE_34_SELF_APPLY_PLAN.md).
--
-- 1) vacancy_invitation_origin enum + vacancy_invitations.origin:
--    who initiated the (vacancy × seeker) row. Default keeps every
--    existing row and every employer-side write correct without a
--    backfill.
-- 2) vacancy_invitations.invited_by_user_id becomes NULLABLE  a
--    self-applied row has no inviting org member. Every employer-side
--    write path still stamps it.
-- 3) vacancies gains: self_apply_enabled (kill-switch toggle, default
--    OFF), self_apply_token (unguessable public-link token, minted on
--    first enable, UNIQUE), salary_visible_to_applicants (D2  shown
--    to signed-in seekers on the apply page unless the employer opts
--    out; anonymous payload never carries salary regardless).
--
-- Idempotent throughout (IF NOT EXISTS / catch duplicate_object /
-- conditional DROP NOT NULL).

DO $$ BEGIN
  CREATE TYPE vacancy_invitation_origin AS ENUM ('employer_invite', 'self_apply');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vacancy_invitations
  ADD COLUMN IF NOT EXISTS origin vacancy_invitation_origin NOT NULL DEFAULT 'employer_invite';

-- Drop NOT NULL on invited_by_user_id (no-op when already nullable).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vacancy_invitations'
      AND column_name = 'invited_by_user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE vacancy_invitations ALTER COLUMN invited_by_user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS self_apply_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS self_apply_token text;

ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS salary_visible_to_applicants boolean NOT NULL DEFAULT true;

-- Unguessable token must be unique  it IS the public address.
CREATE UNIQUE INDEX IF NOT EXISTS vacancies_self_apply_token_uq
  ON vacancies (self_apply_token)
  WHERE self_apply_token IS NOT NULL;

-- Seed the ship-dark platform flag (default OFF) so /admin/settings
-- shows the switch without a code deploy dependency. jsonb 'false'.
INSERT INTO platform_settings (key, value)
  VALUES ('feature_flag_vacancy_self_apply', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;
