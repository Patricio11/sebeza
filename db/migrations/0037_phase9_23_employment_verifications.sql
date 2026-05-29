-- Phase 9.23  opt-in employment verification.
--
-- A seeker can opt into verifying their currently-declared employer
-- (Phase 9.22) by entering ONE contact at the employer (name + work
-- email). Sebenza sends ONE transactional email; the contact verifies,
-- declines, or marks "not me"; the contact's email is REDACTED within
-- 14 days regardless of outcome (D4 in the plan).
--
-- POPIA-clean by construction: the contact's email lives at most 14
-- days in encrypted form. A SHA-256 hash + a consent.grant audit row
-- with `meta.contact_email_hash` prove consent existed at submission
-- without persisting the third-party PII.
--
-- One row per verification request. Lifecycle states encoded on the
-- column; cron sweeps `pending` past `expires_at`. Token cleared on
-- response so the verify link can't be replayed.

-- ── enum ──────────────────────────────────────────────────────────────

CREATE TYPE "employment_verification_state" AS ENUM (
  'pending',     -- seeker submitted; email out; contact has 14d
  'verified',    -- contact clicked the verify link
  'declined',    -- contact clicked the decline link
  'disputed',    -- contact clicked the "I'm not this person's employer" link
  'expired',     -- 14 days elapsed without contact response
  'superseded',  -- seeker changed current_employer_org_id (Phase 9.22 D7)
  'withdrawn'    -- seeker withdrew the request before contact responded
);

-- ── table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "employment_verifications" (
  "id"                      text PRIMARY KEY,
  "profile_id"              text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "employer_org_id"         text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  -- Contact at the employer named by the seeker. The name stays
  -- durable (it identifies the consent context); the email is
  -- encrypted + redactable.
  "contact_name"            text NOT NULL,
  -- AES-GCM encrypted contact email. NULLed out post-response or
  -- post-expiry (D4: redacted within the 14-day window). NEVER
  -- displayed back to the seeker.
  "contact_email_enc"       text,
  -- SHA-256 hex of the contact email at submit time. Stays durable
  -- as the consent.grant proof + the per-pair dedupe key (D8: max 2
  -- verifications per (seeker, contact-hash) per 12 months).
  "contact_email_hash"      text NOT NULL,
  "state"                   "employment_verification_state" NOT NULL DEFAULT 'pending',
  "requested_at"            timestamptz NOT NULL DEFAULT now(),
  "responded_at"            timestamptz,
  -- Token-scoped 14-day window. Set on insert; cron filters by
  -- `state='pending' AND expires_at < now()`.
  "expires_at"              timestamptz NOT NULL,
  -- URL-safe random token. Cleared on response or expiry so the
  -- verify link can't be replayed.
  "verification_token"      text,
  -- D7: when the seeker changes current_employer_org_id, an
  -- in-flight or verified record for the prior employer gets
  -- flipped to state='superseded' (no new id; the column is null).
  -- This column reserves space for future "this was replaced by
  -- verification id X" lineage but is unused at first ship.
  "superseded_by_id"        text REFERENCES "employment_verifications"("id") ON DELETE SET NULL
);

-- Per-seeker list / state filter (dashboard read).
CREATE INDEX IF NOT EXISTS "employment_verifications_profile_state_idx"
  ON "employment_verifications" ("profile_id", "state");

-- Token lookup for the verify landing page. Unique so a leaked /
-- reused token can't address two rows.
CREATE UNIQUE INDEX IF NOT EXISTS "employment_verifications_token_uniq"
  ON "employment_verifications" ("verification_token")
  WHERE "verification_token" IS NOT NULL;

-- Cron sweep: `pending` past expiry.
CREATE INDEX IF NOT EXISTS "employment_verifications_expiry_idx"
  ON "employment_verifications" ("expires_at")
  WHERE "state" = 'pending';

-- Rate-limit + dedupe: how often the seeker has hit this contact in
-- the last 12 months. Partial WHERE keeps it slim.
CREATE INDEX IF NOT EXISTS "employment_verifications_dedupe_idx"
  ON "employment_verifications" ("profile_id", "contact_email_hash", "requested_at");
