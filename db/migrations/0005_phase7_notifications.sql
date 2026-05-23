-- Phase 7 (Task 7.6)  In-app notifications.
--
-- Adds the `notifications` table + the `notification_prefs` JSONB
-- column on `app_user`. Notifications are UX state  the audit log
-- remains authoritative for any PII access. See docs/PHASE_7_PLAN.md
-- §C for the design rationale (separate table over an audit_log view,
-- polling over WebSockets, idempotency-aware createNotification, etc.).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notifications table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         text PRIMARY KEY,
  "user_id"    text NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "kind"       text NOT NULL,
  "title"      text NOT NULL,
  "body"       text,
  "link"       text,
  "meta"       jsonb,
  "read_at"    timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Drives the dropdown panel + full-page list (latest first).
CREATE INDEX IF NOT EXISTS notifications_user_at_idx
  ON notifications (user_id, created_at DESC);

-- Drives the unread badge count + bell polling. Partial index over the
-- `read_at IS NULL` rows keeps the hot query cheap even when a user has
-- thousands of historical notifications.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Supports the dedupe lookup inside `createNotification`  find the
-- most-recent matching kind for a user.
CREATE INDEX IF NOT EXISTS notifications_user_kind_at_idx
  ON notifications (user_id, kind, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notification_prefs on app_user (JSONB; missing keys fall back to catalog defaults)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb;
