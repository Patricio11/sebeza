-- Phase 9.21  add `seasonal` to work_availability_kind + add the
-- vacancy-side season window columns.
--
-- The chip lives on the same enum as the Phase 9.18 work-mode +
-- employment-type values (casual / part_time / contract / full_time
-- / remote / hybrid). Adding `seasonal` makes the matcher's existing
-- array-overlap query work without a translation layer  same
-- posture as 9.18 took for remote / hybrid, same Postgres caveat
-- (ADD VALUE must run outside a transaction block; drizzle-kit
-- migrate treats each file as its own transaction so this stands
-- alone).
--
-- Season window (vacancy-only, D2 in the plan): three nullable
-- columns. NULL = "no window declared, matcher still array-overlaps
-- on the chip." Both month columns are NULL or both are set; the Zod
-- schema in the action layer enforces this pairing (Postgres CHECK
-- constraints are heavier than we need here).
--
-- `IF NOT EXISTS` keeps every change re-runnable against local DBs
-- where someone may have `db:push`-ed against the schema first.

ALTER TYPE "work_availability_kind" ADD VALUE IF NOT EXISTS 'seasonal';

ALTER TABLE "vacancies"
  ADD COLUMN IF NOT EXISTS "seasonal_window_start_month" int,
  ADD COLUMN IF NOT EXISTS "seasonal_window_end_month" int,
  ADD COLUMN IF NOT EXISTS "seasonal_window_recurring_annually" boolean;
