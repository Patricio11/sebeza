-- Phase 9.12  The learning loop (student growth path).
--
-- Three changes, all additive  no destructive operations, no data
-- backfill required beyond column defaults:
--
-- 1. `profile_skills` gains two columns for the provenance honesty
--    contract (D1 in PHASE_9_12_PLAN.md):
--      - provenance   : how this skill entry was created. Default
--                       'self_attested' so existing rows match the
--                       Verification-Honesty Rule's current truth (every
--                       skill on the platform today was self-attested).
--                       9.12.4 inserts new completion-driven rows with
--                       'self_attested_learning' to distinguish them.
--      - verified_at  : timestamp the dormant Phase 8 SAQA/provider
--                       adapter would stamp on verification. Stays NULL
--                       at 9.12 ship; the UI honesty contract is "show
--                       Verified ONLY when provenance='verified_provider'
--                       AND verified_at IS NOT NULL".
--
-- 2. New `learning_state` + `abandon_reason` enums + `learning_items`
--    table. One row per (profile, accepted-recommendation) instance.
--    The seeker's own audit trail of "I tried to learn X." Indexed for
--    the two hot read paths: (profile_id, state) for the My Learning
--    section + (skill_slug, state) for 9.13's stall analytics.
--
-- 3. `nudge_last_sent_at` anchor column on `learning_items` for the
--    9.12.6 cron idempotency (mirrors `profiles.status_stale_last_sent_at`).

CREATE TYPE "skill_provenance" AS ENUM (
  'self_attested',
  'self_attested_learning',
  'imported',
  'verified_provider'
);

ALTER TABLE "profile_skills"
  ADD COLUMN IF NOT EXISTS "provenance"  "skill_provenance" NOT NULL DEFAULT 'self_attested',
  ADD COLUMN IF NOT EXISTS "verified_at" timestamp;

CREATE TYPE "learning_state" AS ENUM (
  'accepted',
  'in_progress',
  'completed',
  'abandoned'
);

CREATE TYPE "abandon_reason" AS ENUM (
  'too_expensive',
  'no_time',
  'course_quality',
  'access_transport',
  'changed_direction',
  'too_difficult',
  'other'
);

CREATE TABLE IF NOT EXISTS "learning_items" (
  "id"                  text PRIMARY KEY,
  "profile_id"          text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "skill_slug"          text NOT NULL REFERENCES "skills"("slug"),
  "title"               text NOT NULL,
  "provider"            text NOT NULL,
  "resource_url"        text,
  "resource_kind"       text NOT NULL,
  "is_free"             boolean NOT NULL DEFAULT false,
  "state"               "learning_state" NOT NULL DEFAULT 'accepted',
  "started_at"          timestamp,
  "completed_at"        timestamp,
  "abandoned_at"        timestamp,
  "abandon_reason"      "abandon_reason",
  "abandon_note"        text,
  "nudge_last_sent_at"  timestamp,
  "created_at"          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "learning_items_profile_state_idx"
  ON "learning_items" ("profile_id", "state");

CREATE INDEX IF NOT EXISTS "learning_items_skill_state_idx"
  ON "learning_items" ("skill_slug", "state");
