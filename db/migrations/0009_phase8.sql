-- Phase 8  Verification & Integrations.
--
-- Schema for the email channel + cron infrastructure + KYC + SAQA
-- adapters. Both adapter integrations land here but stay dormant
-- behind admin-controlled feature flags until partnership confirmation
-- (per the user's standing instruction). See platform_settings inserts
-- at the bottom.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. app_user  email rate-limit clock + KYC transaction id
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "notification_email_last_sent_at" jsonb;

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "kyc_transaction_id" text;

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "kyc_verified_at" timestamp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles  status-stale nudge idempotency anchor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "status_stale_last_sent_at" timestamp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. saved_searches  last-match hash so the cron only fires on NEW matches
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "saved_searches"
  ADD COLUMN IF NOT EXISTS "last_match_hash" text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. outcome_snapshots  time-series for the Phase 7.5.4 outcomes dataset
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "outcome_snapshots" (
  "id"                          text PRIMARY KEY,
  "captured_at"                 timestamp NOT NULL DEFAULT now(),
  "programme"                   text NOT NULL,
  "institution"                 text NOT NULL,
  "province"                    text NOT NULL,
  "graduation_year"             integer NOT NULL,
  "cohort_size"                 integer NOT NULL,
  "placed"                      integer NOT NULL,
  "placement_rate"              text NOT NULL,
  "median_time_to_hire_days"    integer,
  "top_destination_profession"  text,
  "min_cohort_size"             integer NOT NULL
);

CREATE INDEX IF NOT EXISTS outcome_snapshots_at_idx
  ON outcome_snapshots (captured_at DESC);

CREATE INDEX IF NOT EXISTS outcome_snapshots_cohort_idx
  ON outcome_snapshots (programme, institution, province, graduation_year, captured_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. qualification_kyc_jobs  SAQA worker queue (only used when the
--    `feature_flag_saqa_worker` flag is ON  admin flips after partnership)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qualification_kyc_status') THEN
    CREATE TYPE "qualification_kyc_status" AS ENUM (
      'queued',
      'in_flight',
      'verified',
      'mismatch',
      'error'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "qualification_kyc_jobs" (
  "id"                       text PRIMARY KEY,
  "qualification_id"         text NOT NULL REFERENCES "qualifications"("id") ON DELETE CASCADE,
  "submitted_at"             timestamp NOT NULL DEFAULT now(),
  "submitted_by_user_id"     text NOT NULL,
  "status"                   qualification_kyc_status NOT NULL DEFAULT 'queued',
  "result_json"              jsonb,
  "provider_transaction_id"  text,
  "attempt_count"            integer NOT NULL DEFAULT 0,
  "completed_at"             timestamp
);

-- The cron worker grabs `queued` rows oldest-first.
CREATE INDEX IF NOT EXISTS qualification_kyc_jobs_queued_idx
  ON qualification_kyc_jobs (submitted_at)
  WHERE status = 'queued';

-- Admin UI joins the latest job per qualification.
CREATE INDEX IF NOT EXISTS qualification_kyc_jobs_qual_idx
  ON qualification_kyc_jobs (qualification_id, submitted_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Seed the two new feature flags (both default OFF  partnership-gated).
--    Re-runnable; ON CONFLICT preserves any admin-set values from prior runs.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "platform_settings" ("key", "value")
VALUES
  ('feature_flag_kyc_provider', 'false'::jsonb),
  ('feature_flag_saqa_worker',  'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;
