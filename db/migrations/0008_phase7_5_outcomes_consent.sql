-- Phase 7.5  `outcomes_research` consent purpose.
--
-- A student consenting to "be found for jobs" has NOT consented to
-- "be a longitudinal data point in a government outcomes study."
-- POPIA treats these as different purposes, so we add a separate,
-- optional, default-off, non-degrading consent purpose. The 7.5.4
-- analytics queries include a profile ONLY if this is granted.
--
-- Isolated in its own migration because PG enum extensions are
-- transaction-sensitive on older PG (< 12). Neon is PG 16 so the
-- in-tx path works, but we keep this file additive-only to make
-- future enum extensions easy to follow.

-- IF NOT EXISTS makes this re-runnable on any environment that already
-- has the value (PG 9.6+).

ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS 'outcomes_research';
