-- AI-drafted role blueprints (docs/ROLE_BLUEPRINTS_PLAN.md, part 2).
-- One row per draft; the payload holds the reviewed tiers. Nothing here
-- reaches a seeker: approval copies rows into profession_skill_blueprints.

CREATE TABLE IF NOT EXISTS blueprint_drafts (
  id                  text PRIMARY KEY,
  profession_slug     text NOT NULL,
  payload             jsonb NOT NULL,
  state               text NOT NULL DEFAULT 'pending',
  raw_model           text,
  created_by_user_id  text,
  resolved_by_user_id text,
  resolved_at         timestamp,
  created_at          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blueprint_drafts_profession_state_idx
  ON blueprint_drafts (profession_slug, state, created_at DESC);
