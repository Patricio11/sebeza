-- Phase 11.1.4  seeker achievement badges.
--
-- Six honest milestones surfaced as small medallions on /dashboard.
-- Each derived from existing audit-log data (no new event source).
-- Awarded by a nightly cron via idempotent insert (UNIQUE constraint
-- catches re-runs). Never auto-revoked  badges accumulate; admin
-- moderation actions (suspend / restore) interact with badges via
-- the existing app_user.suspendedAt path (suspended accounts get a
-- conditional UI hide; the rows stay).

CREATE TABLE "seeker_badges" (
  "id"           text PRIMARY KEY,
  "profile_id"   text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "slug"         text NOT NULL,
  "awarded_at"   timestamp NOT NULL DEFAULT now(),
  UNIQUE("profile_id", "slug")
);

CREATE INDEX "idx_seeker_badges_by_profile"
  ON "seeker_badges" ("profile_id", "awarded_at" DESC);
