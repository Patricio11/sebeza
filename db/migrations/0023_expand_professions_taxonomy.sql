-- Expand the canonical profession taxonomy.
--
-- The /sign-up + profile editor + vacancy form all read professions
-- from this table. Previously seeded with 13 entries  too narrow for
-- a national platform. This migration converges any database to the
-- full ~60-entry catalogue (hospitality, tech, trades, healthcare,
-- education, transport, retail, security, cleaning, beauty,
-- agriculture, mining).
--
-- ON CONFLICT DO NOTHING preserves any custom rows admins added via
-- /admin/taxonomy. Re-running this migration is a no-op past the
-- first apply.

INSERT INTO professions (slug, label) VALUES
  -- Hospitality
  ('chef',                  'Chef'),
  ('cook',                  'Cook'),
  ('kitchen-porter',        'Kitchen Porter'),
  ('waitstaff',             'Waitstaff'),
  ('barista',               'Barista'),
  ('bartender',             'Bartender'),
  ('restaurant-manager',    'Restaurant Manager'),
  ('hotel-receptionist',    'Hotel Receptionist'),
  ('housekeeping',          'Housekeeping Attendant'),
  -- Tech + IT
  ('software-developer',    'Software Developer'),
  ('help-desk',             'Help Desk / IT Support'),
  -- Admin + office
  ('call-centre-agent',     'Call-Centre Agent'),
  ('hr-practitioner',       'HR Practitioner'),
  ('receptionist',          'Receptionist'),
  ('admin-clerk',           'Administrative Clerk'),
  ('personal-assistant',    'Personal Assistant'),
  -- Finance
  ('accountant',            'Accountant'),
  ('bookkeeper',            'Bookkeeper'),
  -- Trades + construction
  ('electrician',           'Electrician'),
  ('plumber',               'Plumber'),
  ('bricklayer',            'Bricklayer'),
  ('carpenter',             'Carpenter'),
  ('painter',               'Painter'),
  ('tiler',                 'Tiler'),
  ('roofer',                'Roofer'),
  ('plasterer',             'Plasterer'),
  ('boilermaker',           'Boilermaker'),
  ('welder',                'Welder'),
  -- Automotive + technical
  ('mechanic',              'Mechanic'),
  ('panel-beater',          'Panel Beater'),
  ('aircon-technician',     'Aircon Technician'),
  ('fridge-technician',     'Fridge Technician'),
  -- Healthcare
  ('nurse',                 'Nurse'),
  ('caregiver',             'Caregiver'),
  ('paramedic',             'Paramedic'),
  ('pharmacy-assistant',    'Pharmacy Assistant'),
  ('dental-assistant',      'Dental Assistant'),
  -- Education
  ('teacher',               'Teacher'),
  ('tutor',                 'Tutor'),
  ('ecd-practitioner',      'ECD Practitioner'),
  ('lecturer',              'Lecturer'),
  ('sports-coach',          'Sports Coach'),
  -- Transport
  ('driver',                'Driver'),
  ('truck-driver',          'Truck Driver (long-haul)'),
  ('delivery-driver',       'Delivery Driver'),
  ('taxi-driver',           'Taxi Driver'),
  ('forklift-operator',     'Forklift Operator'),
  ('crane-operator',        'Crane Operator'),
  -- Retail + service
  ('retail-assistant',      'Retail Assistant'),
  ('cashier',               'Cashier'),
  ('store-manager',         'Store Manager'),
  ('visual-merchandiser',   'Visual Merchandiser'),
  -- Security
  ('security-officer',      'Security Officer'),
  ('armed-response',        'Armed Response Officer'),
  ('cctv-operator',         'CCTV Operator'),
  -- Cleaning + facilities
  ('domestic-worker',       'Domestic Worker'),
  ('cleaner',               'Cleaner'),
  ('caretaker',             'Caretaker'),
  ('gardener',              'Gardener'),
  -- Beauty + wellness
  ('hairstylist',           'Hairstylist'),
  ('barber',                'Barber'),
  ('beauty-therapist',      'Beauty Therapist'),
  ('nail-technician',       'Nail Technician'),
  -- Agriculture + mining
  ('farm-worker',           'Farm Worker'),
  ('miner',                 'Miner'),
  ('mine-safety-officer',   'Mine Safety Officer')
ON CONFLICT (slug) DO NOTHING;
