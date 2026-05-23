-- Phase 7 (Part 1) — Admin actions, moderation, platform settings.
--
-- Adds the schema needed for:
--   1. `reports` — public Report-this-profile button (from /p/[handle])
--      plus admin moderation queue.
--   2. `app_user.suspended_at` + `app_user.suspended_reason` — admin
--      suspend/restore flow; suspended users are bounced at sign-in.
--   3. `platform_settings` — key/value JSONB store for freshness band
--      thresholds, ranking weights, feature flags. Replaces the
--      hardcoded constants the Phase 6.5 rank query carries.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reports + enums
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE "report_reason" AS ENUM (
      'fake_identity',
      'inappropriate',
      'harassment',
      'spam',
      'other'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE "report_status" AS ENUM (
      'open',
      'closed_no_action',
      'actioned'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "reports" (
  "id"                text PRIMARY KEY,
  "subject_profile_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "reporter_user_id"   text REFERENCES "app_user"("id"),
  -- Reports may come from anonymous public users; reporter_user_id is nullable.
  "reason"            report_reason NOT NULL,
  "note"              text,
  "status"            report_status NOT NULL DEFAULT 'open',
  "created_at"        timestamp NOT NULL DEFAULT now(),
  "closed_at"         timestamp,
  "closed_by_user_id" text REFERENCES "app_user"("id"),
  "closed_reason"     text
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_subject_idx ON reports (subject_profile_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Suspend/restore columns on app_user
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "suspended_at" timestamp;

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "suspended_reason" text;

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "suspended_by_user_id" text REFERENCES "app_user"("id");

CREATE INDEX IF NOT EXISTS app_user_suspended_at_idx ON app_user (suspended_at) WHERE suspended_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Platform settings (key/value JSONB)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key"                 text PRIMARY KEY,
  "value"               jsonb NOT NULL,
  "updated_at"          timestamp NOT NULL DEFAULT now(),
  "updated_by_user_id"  text REFERENCES "app_user"("id")
);

-- Seed default values for the existing UI fields on /admin/settings.
-- Re-runnable — ON CONFLICT preserves any admin-set values from prior runs.
INSERT INTO "platform_settings" ("key", "value")
VALUES
  ('freshness_band_days_fresh',  '30'::jsonb),
  ('freshness_band_days_ageing', '90'::jsonb),
  ('ranking_weight_freshness',   '1.0'::jsonb),
  ('ranking_weight_completeness','1.0'::jsonb),
  ('ranking_weight_citizen_boost','1.08'::jsonb),
  ('feature_flag_2fa_enforced',  'false'::jsonb),
  ('feature_flag_email_notifications', 'false'::jsonb),
  ('feature_flag_gov_portal',    'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;
