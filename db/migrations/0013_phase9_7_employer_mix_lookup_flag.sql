-- Phase 9.7.6  Per-employer governed lookup feature flag.
--
-- Default OFF. Activation pairs with a formal Department of
-- Employment & Labour partnership workflow (D3, PHASE_9_7_PLAN.md).
-- Same dormant-by-default posture as the KYC and SAQA adapters
-- from Phase 8.
--
-- Seeded explicitly so the row exists from day one  the prior
-- value on the first admin flip is then `false` rather than `null`,
-- which makes the `setting.update` audit-log entry read more
-- honestly ("changed from false to true" vs "changed from null to
-- true").
--
-- ON CONFLICT DO NOTHING so re-running the migration is safe and a
-- subsequent admin flip is never clobbered on redeploy.

INSERT INTO "platform_settings" ("key", "value")
VALUES
  ('feature_flag_employer_mix_lookup', 'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;
