-- Phase 7 (Task 7.2)  Two-factor authentication.
--
-- Adds the `two_factor` table (Better Auth's twoFactor plugin storage)
-- plus the `app_user.two_factor_enabled` flag. The plugin handles all
-- of: TOTP secret generation, backup code hashing, verify-totp +
-- verify-backup-code endpoints, and the sign-in handshake (returns
-- `{ twoFactorRedirect: true }` when a password is correct but 2FA
-- is on, so the user's session isn't minted until they hand over the
-- second factor).
--
-- Forced enrollment for employer + admin sessions runs at the DAL
-- layer via a new guard.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. app_user.two_factor_enabled flag
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. two_factor table (matches Better Auth plugin schema exactly)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "two_factor" (
  "id"           text PRIMARY KEY,
  "user_id"      text NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "secret"       text NOT NULL,
  "backup_codes" text NOT NULL,
  "verified"     boolean NOT NULL DEFAULT true
);

-- Plugin schema marks both `secret` and `user_id` as indexed; one row
-- per user in practice.
CREATE INDEX IF NOT EXISTS two_factor_user_id_idx ON two_factor (user_id);
CREATE INDEX IF NOT EXISTS two_factor_secret_idx ON two_factor (secret);
