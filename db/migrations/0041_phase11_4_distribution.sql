-- Phase 11.4  SA distribution surface.
--
-- Five additive schema changes:
--
--   1. seeker_followed_employers  private follow list           (Task 11.4.2)
--   2. app_user.data_saver_mode column                            (Task 11.4.3)
--   3. app_user phone + channel-pref columns                      (Task 11.4.4)
--   4. seeker_sms_allowlist table (admin-gated rollout)           (Task 11.4.4)
--   5. consent_purpose enum gains messaging_channel_{sms,whatsapp} (Task 11.4.4)
--
-- Task 11.4.1 (share card PNG) is UI-only; no DDL.
-- Task 11.4.5 (recommended employers) reads from existing tables; no DDL.
--
-- ALL Task 11.4.4 surfaces ship DORMANT by default. SMS / WhatsApp
-- dispatch is gated behind admin feature flags
-- (`feature_flag_sms_channel_enabled`, `feature_flag_whatsapp_channel_enabled`)
-- in `platform_settings`. No external provider is called until an
-- admin explicitly flips the flag from /admin/settings AND the seeker
-- has opted in + verified their phone AND is in the allowlist.

-- ──────────────────────────────────────────────────────────────────────
-- 1. SEEKER FOLLOWED EMPLOYERS  private to seeker. Mirrors the block
--    list privacy invariant from 11.3.2: the employer is NEVER notified
--    + never sees a follower count.
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seeker_followed_employers (
  id          text PRIMARY KEY,
  profile_id  text NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  org_id      text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  followed_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (profile_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_followed_employers_by_profile
  ON seeker_followed_employers(profile_id);

CREATE INDEX IF NOT EXISTS idx_followed_employers_by_org
  ON seeker_followed_employers(org_id);

-- ──────────────────────────────────────────────────────────────────────
-- 2. DATA SAVER MODE  seeker-side preference; defaults OFF so the
--    visual experience is unchanged for existing users. The CSS
--    `prefers-reduced-data` media query is the floor; the toggle is
--    the ceiling.
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS data_saver_mode boolean NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────────
-- 3. PHONE + CHANNEL PREFERENCES on app_user.
--
--    `phone_e164_enc` stores the AES-256-GCM-encrypted phone number
--    via the existing lib/crypto helper (Phase 0). NEVER stored in
--    plaintext. NULL when no phone is on file.
--
--    `phone_verified_at` gates every send  the dispatch layer
--    refuses to send to an unverified phone. Both channels share the
--    same verification (one phone, two channels).
--
--    `sms_channel_enabled` + `whatsapp_channel_enabled` are the
--    seeker's per-channel opt-in flags. Default OFF; the seeker
--    explicitly grants on /dashboard/account.
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS phone_e164_enc          text,
  ADD COLUMN IF NOT EXISTS phone_verified_at       timestamp,
  ADD COLUMN IF NOT EXISTS sms_channel_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_channel_enabled boolean NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────────
-- 4. SMS ALLOWLIST (admin-gated rollout)
--
--    Phase 11.4.4 D5: SMS + WhatsApp ship with an allowlist gate,
--    not full availability. The admin flips a seeker INTO the
--    allowlist from /admin/users/* before that seeker's opt-in
--    actually fires a real send.
--
--    The presence of a row here means the admin has approved this
--    seeker for the real-provider dispatch path. Absence means
--    the dispatcher console-logs the intent and audits, but does
--    not call the provider  zero spend.
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seeker_sms_allowlist (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  enabled_at  timestamp NOT NULL DEFAULT now(),
  enabled_by  text REFERENCES app_user(id),
  note        text,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_allowlist_by_user
  ON seeker_sms_allowlist(user_id);

-- ──────────────────────────────────────────────────────────────────────
-- 5. CONSENT PURPOSE  two new optional, default-off purposes.
--    D2: the data flows (phone number + message content to a third-
--    party provider) are material enough to warrant discrete opt-in.
--    The existing service_communications consent is not granular
--    enough.
-- ──────────────────────────────────────────────────────────────────────

ALTER TYPE consent_purpose ADD VALUE IF NOT EXISTS 'messaging_channel_sms';
ALTER TYPE consent_purpose ADD VALUE IF NOT EXISTS 'messaging_channel_whatsapp';
