-- Phase 24 ("Testimonials")  real, consented user quotes replacing the
-- fabricated landing testimonials removed in Phase 23.2. Admin-run collection
-- campaign; only `approved` rows render publicly; display fields are captured
-- at submission with explicit consent (never live PII joins).
--
-- Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS testimonials (
  id               text PRIMARY KEY,
  -- null for admin-created entries
  user_id          text REFERENCES app_user(id) ON DELETE SET NULL,
  -- "seeker" | "employer" | "admin"
  author_role      text NOT NULL,
  quote            text NOT NULL,
  display_name     text NOT NULL,
  display_context  text NOT NULL,
  consent_display  boolean NOT NULL DEFAULT false,
  -- "pending" | "approved" | "hidden"
  state            text NOT NULL DEFAULT 'pending',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonial_prompt_state (
  user_id       text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  snoozed_until timestamp,
  submitted_at  timestamp
);
