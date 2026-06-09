-- Phase 13.3  llm_providers admin-managed configuration table.
--
-- Departs from the env-driven posture of SMS / WhatsApp + email
-- transport on purpose. LLM configuration is a moving target
-- (model versions roll, providers change pricing, ops wants to
-- A/B between vendors); DB-stored config gives the admin full
-- operational control without involving devops.
--
-- Invariants enforced at the DB layer:
--
--   1. At most one row has active=true. Partial unique index
--      `llm_providers_one_active`. The activateLlmProvider() server
--      action wraps the deactivate-all + activate-one in a single
--      transaction; the index is the safety net that catches a race.
--
--   2. credentials_enc is the AES-256-GCM ciphertext from
--      lib/crypto.encryptField() of a JSON blob:
--        { apiKey: string, modelId: string,
--          endpointUrl?: string, extraHeaders?: object }
--      Never logged, never returned plaintext via API; the admin UI
--      shows last 4 chars only.
--
--   3. monthly_budget_zar defaults to 0 = no LLM use until the admin
--      sets a budget. Hard-gates the six-gate dispatch in
--      lib/llm/curriculum.ts; zero spend until explicit approval.
--
--   4. Cross-border POPIA s.72 acknowledgement gates the configure
--      flow for openai + anthropic. The acknowledgement timestamp
--      lives in the audit row (admin.llm.provider.configured) so the
--      auditor sees who acknowledged + when. Self-hosted is the
--      POPIA-clean recommended path.

-- IF-NOT-EXISTS guards added retroactively
-- (docs/MIGRATION_JOURNAL_RECOVERY_PLAN.md).
CREATE TABLE IF NOT EXISTS llm_providers (
  -- Stable provider id, also the slug. Seeded with the 4 supported
  -- providers below; admins don't create new rows, they configure
  -- the existing rows.
  id                  text PRIMARY KEY,
  display_name        text NOT NULL,
  -- True for the currently-dispatching provider. Enforced
  -- at-most-one via the partial unique index below.
  active              boolean NOT NULL DEFAULT false,
  -- AES-256-GCM ciphertext via lib/crypto.encryptField(). NULL
  -- until the admin configures the provider on /admin/llm.
  credentials_enc     text,
  -- Hard budget cap in ZAR. The six-gate dispatch refuses any
  -- call when total_spend_zar >= monthly_budget_zar OR when this
  -- column is 0. Reset to 0 from the admin UI = immediate pause.
  monthly_budget_zar  integer NOT NULL DEFAULT 0,
  configured_by       text REFERENCES app_user(id) ON DELETE SET NULL,
  configured_at       timestamp,
  last_used_at        timestamp,
  total_calls         integer NOT NULL DEFAULT 0,
  total_tokens        bigint  NOT NULL DEFAULT 0,
  total_spend_zar     numeric(12,2) NOT NULL DEFAULT 0,
  -- NULL until the admin acknowledges cross-border processing.
  -- Set on the configure action for openai + anthropic. Audit row
  -- carries the acknowledgement separately for the auditor view.
  s72_acknowledged_at timestamp,
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now()
);

-- At-most-one-active enforcement. Postgres treats `WHERE active = true`
-- as a partial index; rows with active=false are not part of the index
-- so any number of inactive rows coexist freely.
CREATE UNIQUE INDEX IF NOT EXISTS llm_providers_one_active
  ON llm_providers(active)
  WHERE active = true;

-- Seed the 4 supported providers in dormant state. The admin lands
-- on /admin/llm and sees all four ready to configure; no env-var
-- bootstrap, everything starts in the UI.
INSERT INTO llm_providers (id, display_name, active, monthly_budget_zar)
VALUES
  ('openai',      'OpenAI',                 false, 0),
  ('anthropic',   'Anthropic',              false, 0),
  ('mistral',     'Mistral',                false, 0),
  ('self_hosted', 'Self-hosted (POPIA-clean)', false, 0)
ON CONFLICT (id) DO NOTHING;

-- Kill-switch above the DB-stored provider config. Setting OFF
-- short-circuits the dispatch even if a provider is active +
-- budget is set. Default OFF; the admin explicitly turns it on
-- after configuring + testing a provider.
INSERT INTO platform_settings (key, value)
VALUES ('feature_flag_llm_curriculum_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
