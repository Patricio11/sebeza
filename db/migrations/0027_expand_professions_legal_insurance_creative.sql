-- Expand profession taxonomy with five more SA sectors that were
-- missed in the 0023/0025/0026 sweeps. Flagged 2026-05-26 system
-- review. 24 new entries across 5 sectors + 1 add to Tech.
--
--   Tech: ux-ui-designer (overlap with software-developer but
--         distinct role, common SA tech / creative-tech hybrid)
--
--   Legal (5): attorney, advocate, candidate-attorney, paralegal,
--         legal-secretary. SA-specific naming: "Attorney" (law firm)
--         is distinct from "Advocate" (bar member). "Candidate
--         Attorney" is the SA articled-clerk path.
--
--   Insurance (3): insurance-broker, claims-assessor (SA term;
--         "Claims Adjuster" is US), underwriter.
--
--   Logistics + warehouse (5): warehouse-picker, stock-controller,
--         dispatch-clerk, logistics-coordinator, supply-chain-officer.
--
--   Creative + media (5): graphic-designer, photographer, videographer,
--         copywriter, content-creator (modern social-media talent).
--
--   Sales + marketing (5): sales-representative, marketing-coordinator,
--         social-media-manager, digital-marketer, brand-manager.
--
-- ON CONFLICT DO NOTHING preserves admin-added rows. Re-runs no-op.

INSERT INTO professions (slug, label) VALUES
  -- Tech
  ('ux-ui-designer',          'UX/UI Designer'),
  -- Legal
  ('attorney',                'Attorney'),
  ('advocate',                'Advocate'),
  ('candidate-attorney',      'Candidate Attorney'),
  ('paralegal',               'Paralegal'),
  ('legal-secretary',         'Legal Secretary'),
  -- Insurance
  ('insurance-broker',        'Insurance Broker'),
  ('claims-assessor',         'Claims Assessor'),
  ('underwriter',             'Underwriter'),
  -- Logistics + warehouse
  ('warehouse-picker',        'Warehouse Picker / Packer'),
  ('stock-controller',        'Stock Controller'),
  ('dispatch-clerk',          'Dispatch Clerk'),
  ('logistics-coordinator',   'Logistics Coordinator'),
  ('supply-chain-officer',    'Supply Chain Officer'),
  -- Creative + media
  ('graphic-designer',        'Graphic Designer'),
  ('photographer',            'Photographer'),
  ('videographer',            'Videographer'),
  ('copywriter',              'Copywriter'),
  ('content-creator',         'Content Creator'),
  -- Sales + marketing
  ('sales-representative',    'Sales Representative'),
  ('marketing-coordinator',   'Marketing Coordinator'),
  ('social-media-manager',    'Social Media Manager'),
  ('digital-marketer',        'Digital Marketer'),
  ('brand-manager',           'Brand Manager')
ON CONFLICT (slug) DO NOTHING;
