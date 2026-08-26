-- Profile-completion nudge marker (docs/SEEKER_ONBOARDING_POLISH_PLAN.md,
-- 2026-08-26, founder follow-up).
--
-- The day-after "finish your profile" nudge is sent ONCE per seeker.
-- Rather than inferring "already nudged" from the notifications table
-- (which a seeker can clear), the profile itself records when it was
-- sent. NULL = never nudged. Read by the cron's WHERE and visible to
-- admins as a plain yes/no.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_complete_notified_at timestamp;

CREATE INDEX IF NOT EXISTS profiles_complete_nudge_due_idx
  ON profiles (member_since)
  WHERE profile_complete_notified_at IS NULL AND deleted_at IS NULL;
