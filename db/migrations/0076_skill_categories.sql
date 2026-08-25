-- Skills gain a category: technical | professional
-- (docs/SKILLS_CATEGORIES_MATCHING_PLAN.md, 2026-08-24).
--
-- Default technical: tools, trades, and licences are the bulk of the
-- taxonomy. The backfill below marks the organisational / people /
-- care / compliance skills professional; admins recategorise on
-- /admin/taxonomy from here on.

ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'technical';

UPDATE skills SET category = 'professional' WHERE slug IN (
  'customer-service',
  'classroom-management',
  'lesson-planning',
  'ecd-pedagogy',
  'kitchen-mgmt',
  'menu-design',
  'payroll',
  'bookkeeping-skill',
  'ifrs',
  'reporting',
  'saipa',
  'elderly-care',
  'pediatric-care',
  'medication-administration',
  'swim-coaching',
  'programme-operations-coordination',
  'event-workshop-coordination',
  'multi-stakeholder-engagement-partnerships',
  'knowledge-management-organisational-learning',
  'financial-administration-budget-oversight',
  'documentation-evidence-synthesis-records-database-management'
);
