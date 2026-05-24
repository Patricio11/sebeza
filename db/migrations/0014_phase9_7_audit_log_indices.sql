-- Phase 9.7.7  audit_log indices for the oversight log.
--
-- The /admin/audit-log + /admin/oversight surfaces both query the
-- audit_log table with ORDER BY at DESC, usually filtered by kind
-- (and sometimes by actor). The table has had no indices since
-- Phase 7  fine while it was small (a handful of seed rows + dev
-- traffic), but at production scale every query becomes a seq scan.
--
-- Two indices cover the common patterns:
--   - (at DESC)         the un-filtered tail view (default audit
--                        log) + every CSV export's row-cap path
--   - (kind, at DESC)   the per-kind filter view (oversight log
--                        filters to {gov.employer_mix.lookup,
--                        analytics.export} so it benefits directly)
--
-- Both indices use IF NOT EXISTS so the migration is idempotent.
-- No data change.

CREATE INDEX IF NOT EXISTS "audit_log_at_desc_idx"
  ON "audit_log" ("at" DESC);

CREATE INDEX IF NOT EXISTS "audit_log_kind_at_desc_idx"
  ON "audit_log" ("kind", "at" DESC);
