-- Phase 9 — Add `gov` to the user_role enum.
--
-- Isolated migration (same pattern as Phase 7.5's outcomes_research)
-- because PG enum extensions are transaction-sensitive on older PG.
-- IF NOT EXISTS makes it re-runnable on any environment that already
-- has the value.

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'gov';
