-- Expand profession taxonomy with the property + real estate sector.
-- Missed in 0023's initial expansion; flagged 2026-05-26 during system
-- review. Four entries:
--
--   - estate-agent     (the colloquial SA term; legal title since the
--                       Property Practitioners Act 2019 is "Property
--                       Practitioner" but everyday usage stays "Estate
--                       Agent"  match user intent. Admin can add the
--                       legal title via /admin/taxonomy later if needed)
--   - rental-agent     (residential + commercial letting)
--   - property-manager (body corporate / sectional title / rental
--                       portfolio operations)
--   - property-valuer  (registered valuers; SACPVP-aligned)
--
-- ON CONFLICT DO NOTHING preserves any admin-added rows. Re-runs are
-- no-ops past the first apply.

INSERT INTO professions (slug, label) VALUES
  ('estate-agent',     'Estate Agent'),
  ('rental-agent',     'Rental Agent'),
  ('property-manager', 'Property Manager'),
  ('property-valuer',  'Property Valuer')
ON CONFLICT (slug) DO NOTHING;
