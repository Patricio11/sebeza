-- 2026-08-18  AI-drafted, admin-approved learning-catalogue growth
-- (docs/COMPASS_FUEL_PLAN.md part B). Drafts are staging rows: ONLY an
-- admin approval copies a draft into learning_paths; seekers never read
-- this table.

CREATE TABLE IF NOT EXISTS catalog_drafts (
  id text PRIMARY KEY,
  skill_slugs text[] NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  raw_model text,
  created_by_user_id text NOT NULL REFERENCES app_user(id),
  resolved_by_user_id text REFERENCES app_user(id),
  resolved_at timestamp,
  admin_note text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_drafts_state_idx
  ON catalog_drafts (state, created_at);
