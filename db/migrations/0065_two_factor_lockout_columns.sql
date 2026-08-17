-- 0065 · two_factor lockout columns (Better Auth 1.6.25 schema drift)
--
-- The Phase 32 dependency patch bumped Better Auth to 1.6.25, whose
-- twoFactor plugin model gained `failedVerificationCount` (TOTP guess
-- counter) and `lockedUntil` (temporary lockout). The Drizzle adapter
-- validates its model against our schema on every twoFactor operation,
-- so the missing columns made auth.api.enableTwoFactor() throw and 2FA
-- enrolment was broken for every employer/admin (surfaced by the founder
-- on the live admin account, 2026-08-17; the error was mis-reported as a
-- wrong password by the old catch-all in lib/auth/two-factor.ts).
--
-- Idempotent, applies clean from zero and onto live.

ALTER TABLE "two_factor"
  ADD COLUMN IF NOT EXISTS "failed_verification_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "two_factor"
  ADD COLUMN IF NOT EXISTS "locked_until" timestamp;
