-- Phase 9.7.3  Skills-Shortage Justification Index thresholds.
--
-- Four new platform_settings rows, all tunable from /admin/settings.
-- Defaults are per the PHASE_9_7_PLAN.md D1 decision (2026-05-24):
--
--   lmi_demand_floor             1.0   = 10 distinct employer-searches /
--                                        province / 30 days (the unit is
--                                        per-10 so the headline value is
--                                        a multiple of "ten employers").
--   lmi_local_supply_threshold   0.5   = below this ratio
--                                        (sa_supply / demand_score×10)
--                                        the cell is classed "local
--                                        shortage" if the other
--                                        conditions hold.
--   lmi_foreign_fill_floor       0.5   = at least 50% of confirmed
--                                        placements in the cell went to
--                                        foreign nationals before the
--                                        "foreign-fill" condition fires.
--   employer_mix_min_placements  5     = minimum confirmed placements
--                                        required before a cell can be
--                                        classified at all. Reused by
--                                        9.7.6 (per-employer lookup) so
--                                        there is ONE policy floor, not
--                                        two diverging knobs.
--
-- ON CONFLICT DO NOTHING so re-running the migration is safe and a
-- subsequent admin tune is not clobbered on redeploy.

INSERT INTO "platform_settings" ("key", "value")
VALUES
  ('lmi_demand_floor',             '1.0'::jsonb),
  ('lmi_local_supply_threshold',   '0.5'::jsonb),
  ('lmi_foreign_fill_floor',       '0.5'::jsonb),
  ('employer_mix_min_placements',  '5'::jsonb)
ON CONFLICT ("key") DO NOTHING;
