-- Phase 25 ("Integrations Hub")  admin-managed channel integrations (SMS /
-- WhatsApp / Email), llm_providers posture: encrypted credentials in the DB,
-- configured + enabled from /admin/integrations, env as legacy fallback.
-- DB + Storage deliberately excluded (can't bootstrap DB creds from the DB).
--
-- Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS integration_settings (
  channel            text PRIMARY KEY,
  enabled            boolean NOT NULL DEFAULT false,
  credentials_enc    text,
  config             jsonb,
  updated_at         timestamp NOT NULL DEFAULT now(),
  updated_by_user_id text REFERENCES app_user(id)
);
