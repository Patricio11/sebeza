-- Phase 18 ("Living Learning Catalog")  move the learning-path catalog off the
-- hardcoded `MOCK_COMPASS.learningPaths` constant into an editable, rateable,
-- freshness-tracked table. The seed mirrors the constant exactly (single source)
-- so the compass renders identically post-migration; a parity test asserts it.
--
-- Idempotent (IF NOT EXISTS throughout) so a db:push-recovered schema re-runs
-- as a no-op.

CREATE TABLE IF NOT EXISTS learning_paths (
  id                text PRIMARY KEY,
  title             text NOT NULL,
  provider          text NOT NULL,
  -- free text (mirrors the LearningProviderKind union); no enum so a new
  -- provider kind needs no migration.
  provider_kind     text NOT NULL,
  -- "free" | "subsidised" | "paid".
  cost              text NOT NULL,
  cost_note         text,
  outcome           text NOT NULL,
  duration_weeks    integer NOT NULL,
  -- free-text skill labels (not slugs); matched case-insensitively.
  unlocks_skills    jsonb NOT NULL,
  national          boolean NOT NULL DEFAULT false,
  url               text,
  sebenza_reviewed  boolean NOT NULL DEFAULT false,
  -- freshness contract (18.2): when an admin last re-verified the path.
  last_verified_at  timestamp,
  -- seeker feedback roll-up (18.1); recommend_count <= review_count.
  review_count      integer NOT NULL DEFAULT 0,
  recommend_count   integer NOT NULL DEFAULT 0,
  -- preserves the constant's display order (render parity with the old).
  sort_order        integer NOT NULL DEFAULT 0,
  metadata          jsonb,
  created_at        timestamp NOT NULL DEFAULT now(),
  deleted_at        timestamp
);

-- One row per (seeker, path). would_recommend rolls up into the counts above.
CREATE TABLE IF NOT EXISTS learning_path_reviews (
  id                text PRIMARY KEY,
  path_id           text NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  profile_id        text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  would_recommend   boolean NOT NULL,
  -- optional blocker note; PII-flagged in audit + future exports.
  blocker           text,
  created_at        timestamp NOT NULL DEFAULT now()
);

-- Active-catalog read path (filter deleted_at IS NULL, ordered by sort_order).
CREATE INDEX IF NOT EXISTS learning_paths_active_idx
  ON learning_paths(deleted_at, sort_order);

-- One review per seeker per path.
CREATE UNIQUE INDEX IF NOT EXISTS learning_path_reviews_path_profile_uniq
  ON learning_path_reviews(path_id, profile_id);
