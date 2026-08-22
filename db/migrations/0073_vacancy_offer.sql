-- The counter-offer (founder request, 2026-08-22).
--
-- The platform collects WHY a seeker declined (the structured reason)
-- and shows it to the employer. Until now the only action it offered
-- them was "invite someone else". A counter-offer turns the reason into
-- a conversation: declined -> offer_made -> accepted / declined(final).
--
-- One offer per invitation, EVER, enforced by offer_made_at being
-- written once and checked in the conditional update. Re-offering after
-- a second no is pressure, not recruitment: the same principle as the
-- one-nudge cap on follow-ups.

ALTER TYPE invitation_state ADD VALUE IF NOT EXISTS 'offer_made';

ALTER TABLE vacancy_invitations
  ADD COLUMN IF NOT EXISTS offer_note text,
  ADD COLUMN IF NOT EXISTS offer_made_at timestamp,
  ADD COLUMN IF NOT EXISTS offer_made_by_user_id text;
