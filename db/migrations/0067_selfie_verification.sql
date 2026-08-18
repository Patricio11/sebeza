-- 2026-08-18  selfie verification (docs/SELFIE_VERIFICATION_PLAN.md).
-- The green Verified badge is now earned by a live selfie (browser-side
-- MediaPipe liveness; no biometric data reaches the server). One new
-- fact on profiles + a one-time challenge table.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_verified_at timestamp;

CREATE TABLE IF NOT EXISTS selfie_challenges (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  gestures text[] NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  used_at timestamp
);

CREATE INDEX IF NOT EXISTS selfie_challenges_user_idx
  ON selfie_challenges (user_id, created_at);
