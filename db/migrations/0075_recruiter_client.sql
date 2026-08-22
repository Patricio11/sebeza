-- Recruiters vs direct employers + agency client linkage + congrats
-- invite linkage (docs/RECRUITER_CLIENT_PLAN.md, 2026-08-22).
--
-- org_kind: every existing org predates the question and came through
-- the self-serve employer signup, so the default (direct_employer) is
-- the honest backfill; agencies self-declare from now on.
--
-- vacancies.client_*: an agency's vacancy names WHO the hire is for.
-- client_org_id is the real link when the client exists on Sebenza
-- (picked via typeahead); the free-text columns cover clients that
-- don't. client_contact is org-private and must never reach a
-- seeker-facing or public payload (9.8.8 posture).
--
-- seeker_invitations.congrats_*: the filled-from-elsewhere invite
-- remembers the role + vacancy so acceptance can close the loop
-- (employment link + placement) with both sides on record.

-- direct_employer | recruitment_agency
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_kind text NOT NULL DEFAULT 'direct_employer';

ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS client_org_id text REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS client_city text;
-- Org-private. Never rendered outside the owning workspace.
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS client_contact text;

ALTER TABLE seeker_invitations
  ADD COLUMN IF NOT EXISTS congrats_role text;
ALTER TABLE seeker_invitations
  ADD COLUMN IF NOT EXISTS congrats_vacancy_id text REFERENCES vacancies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vacancies_client_org_idx
  ON vacancies (client_org_id)
  WHERE client_org_id IS NOT NULL;
