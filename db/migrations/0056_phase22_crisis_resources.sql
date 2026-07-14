-- Phase 22.2 ("AI Coach  crisis pathway")  admin-editable crisis-support
-- resources shown when the coach's distress screen fires. DATA, not hardcoded:
-- helpline details change, and a wrong number is itself a safety failure, so an
-- admin adds VERIFIED resources (correctable without a deploy). Not PII.
--
-- Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS crisis_resources (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  contact       text NOT NULL,
  availability  text,
  note          text,
  sort_order    integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamp NOT NULL DEFAULT now()
);
