/**
 * Skill category assignments for the SEEDED taxonomy
 * (docs/SKILLS_CATEGORIES_MATCHING_PLAN.md).
 *
 * ONE list, two consumers: migration 0076 backfills live databases
 * from it (frozen copy in the SQL), and db/seed.ts reads it so every
 * from-zero environment (the test harness re-seeds on every run!)
 * carries the same categories. Skills not listed here default to
 * technical; admins recategorise live rows on /admin/taxonomy.
 */
export const PROFESSIONAL_SKILL_SLUGS: ReadonlySet<string> = new Set([
  "customer-service",
  "classroom-management",
  "lesson-planning",
  "ecd-pedagogy",
  "kitchen-mgmt",
  "menu-design",
  "payroll",
  "bookkeeping-skill",
  "ifrs",
  "reporting",
  "saipa",
  "elderly-care",
  "pediatric-care",
  "medication-administration",
  "swim-coaching",
  "programme-operations-coordination",
  "event-workshop-coordination",
  "multi-stakeholder-engagement-partnerships",
  "knowledge-management-organisational-learning",
  "financial-administration-budget-oversight",
  "documentation-evidence-synthesis-records-database-management",
]);

export function skillCategoryFor(slug: string): "technical" | "professional" {
  return PROFESSIONAL_SKILL_SLUGS.has(slug) ? "professional" : "technical";
}
