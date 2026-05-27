-- Phase 9.17  employer-initiated seeker invites.
--
-- Adds the `seeker_invitations` table that backs the new agent
-- workflow: a verified-org employer enters an email + optional name +
-- profession + 200-char note, Sebenza emails the recipient a signed
-- token, the recipient lands on `/sign-up/invited/[token]` and
-- completes a customised SeekerSignUpForm. Lifecycle states are the
-- same shape Phase 9.8 used for vacancy_invitations + Phase 9.10 used
-- for org documents  pending / accepted / declined / withdrawn /
-- expired  so admin oversight tooling can treat all three queues
-- identically.
--
-- Indices:
--   1. (org_id, state) drives the employer dashboard's three sections
--   2. (lower(email), org_id) drives the D4 dedupe check + D7.2
--      per-email cooldown lookup
--   3. partial index on expires_at gates the nightly cron sweep so
--      we don't scan the whole table

CREATE TYPE "seeker_invitation_state" AS ENUM (
  'pending', 'accepted', 'declined', 'withdrawn', 'expired'
);

CREATE TABLE "seeker_invitations" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id"),
  "invited_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "email" text NOT NULL,
  "name" text,
  "profession" text,
  "personal_note" text,
  "state" "seeker_invitation_state" NOT NULL DEFAULT 'pending',
  "decline_reason" text,
  "accepted_profile_id" text REFERENCES "profiles"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "responded_at" timestamp
);

CREATE INDEX "seeker_invites_org_state_idx"
  ON "seeker_invitations" ("organization_id", "state");

CREATE INDEX "seeker_invites_email_org_idx"
  ON "seeker_invitations" (lower("email"), "organization_id");

CREATE INDEX "seeker_invites_expires_idx"
  ON "seeker_invitations" ("expires_at")
  WHERE "state" = 'pending';
