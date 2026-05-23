-- Phase 9 — Launch-readiness schema add.
--
-- Adds the `lmi_snapshots` table for the Sebenza Labour Market Index
-- time-series. Nothing else needs schema changes this phase — POPIA
-- governance is documents, security hardening is code (CSP headers,
-- rate-limit module, Sentry skeleton). KYC + SAQA + Sentry remain
-- dormant behind the existing platform flags / env-var checks.
--
-- The AWS Cape Town `af-south-1` Postgres migration is deferred to a
-- separate phase; the runbook at docs/AWS_MIGRATION_RUNBOOK.md is
-- self-contained.

CREATE TABLE IF NOT EXISTS "lmi_snapshots" (
  "id"                  text PRIMARY KEY,
  "captured_at"         timestamp NOT NULL DEFAULT now(),
  "value"               text NOT NULL,
  "freshness_ratio"     text NOT NULL,
  "met_demand"          text NOT NULL,
  "placement_velocity"  text NOT NULL
);

CREATE INDEX IF NOT EXISTS lmi_snapshots_at_idx
  ON lmi_snapshots (captured_at DESC);
