-- Phase 9.18  add `remote` + `hybrid` to work_availability_kind.
--
-- Same field already carries the employment-type values (casual /
-- part_time / contract / full_time). Adding work-mode values to the
-- same enum is a deliberate UX-simplicity choice (matches the user's
-- mental model of "what work am I open to") even though it conflates
-- two orthogonal dimensions  documented in the operator-review note
-- on Phase 9.18.
--
-- Postgres requires `ALTER TYPE ... ADD VALUE` to run OUTSIDE a
-- transaction block. drizzle-kit migrate handles each migration file
-- as its own transaction; that's why this is its own file rather
-- than tacked onto an existing one.
--
-- `IF NOT EXISTS` keeps the migration re-runnable + safe to apply
-- against databases where someone tested locally with `db:push`
-- before the migration landed.

ALTER TYPE "work_availability_kind" ADD VALUE IF NOT EXISTS 'remote';
ALTER TYPE "work_availability_kind" ADD VALUE IF NOT EXISTS 'hybrid';
