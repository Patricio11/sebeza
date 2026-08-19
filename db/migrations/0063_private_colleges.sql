-- Private colleges in the institution taxonomy (founder request
-- 2026-07-30, docs/PRIVATE_COLLEGES_TAXONOMY_PLAN.md).
--
-- The student sign-up picker only offered public universities / UoTs /
-- UNISA / TVETs / INDLELA; a large share of SA qualifications come from
-- private providers (Damelin, Rosebank College, Varsity College, Boston,
-- MANCOSA, ...), so those students all fell through to the free-text
-- "my institution isn't listed" path + the admin suggestion queue.
--
-- 17 major accredited private providers, kind='private', anchored at
-- their main-campus city/province. MUST stay in sync with the
-- INSTITUTIONS constant in lib/mock/taxonomy.ts (the picker), the FK
-- on academic_profiles.institution_slug needs these rows to exist.
--
-- Idempotent (ON CONFLICT (slug) DO NOTHING). Existing free-text
-- pending rows (e.g. a typed "Damelin" → slug "other--damelin-…")
-- are untouched; admins can still merge them via /admin/taxonomy.

INSERT INTO institutions (slug, label, kind, city, province_slug) VALUES
  ('damelin',            'Damelin',                                    'private', 'Johannesburg', 'gauteng'),
  ('rosebank-college',   'Rosebank College (IIE)',                     'private', 'Johannesburg', 'gauteng'),
  ('varsity-college',    'Varsity College (IIE)',                      'private', 'Johannesburg', 'gauteng'),
  ('vega-school',        'Vega School (IIE)',                          'private', 'Johannesburg', 'gauteng'),
  ('iie-msa',            'IIE MSA',                                    'private', 'Johannesburg', 'gauteng'),
  ('boston-city-campus', 'Boston City Campus',                         'private', 'Johannesburg', 'gauteng'),
  ('eduvos',             'Eduvos',                                     'private', 'Midrand',      'gauteng'),
  ('richfield',          'Richfield Graduate Institute of Technology', 'private', 'Durban',       'kwazulu-natal'),
  ('mancosa',            'MANCOSA',                                    'private', 'Durban',       'kwazulu-natal'),
  ('milpark',            'Milpark Education',                          'private', 'Johannesburg', 'gauteng'),
  ('stadio',             'STADIO Higher Education',                    'private', 'Centurion',    'gauteng'),
  ('regenesys',          'Regenesys Business School',                  'private', 'Johannesburg', 'gauteng'),
  ('regent',             'Regent Business School',                     'private', 'Durban',       'kwazulu-natal'),
  ('imm',                'IMM Graduate School',                        'private', 'Johannesburg', 'gauteng'),
  ('afda',               'AFDA (School of the Creative Economy)',      'private', 'Johannesburg', 'gauteng'),
  ('ctu',                'CTU Training Solutions',                     'private', 'Pretoria',     'gauteng'),
  ('oxbridge-academy',   'Oxbridge Academy',                           'private', 'Stellenbosch', 'western-cape')
ON CONFLICT (slug) DO NOTHING;
