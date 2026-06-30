/**
 * Phase 20 ("Skill Prerequisites")  read path for the skill dependency graph.
 */

import "server-only";
import { inArray, eq, asc, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type { PrereqEdge } from "@/lib/skills/prereq-graph";

/** Prereq edges for a set of skills (the compass passes its recommended slugs). */
export async function listPrereqsForSkills(
  skillSlugs: string[],
): Promise<PrereqEdge[]> {
  if (skillSlugs.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      skillSlug: schema.skillPrereqs.skillSlug,
      prereqSkillSlug: schema.skillPrereqs.prereqSkillSlug,
    })
    .from(schema.skillPrereqs)
    .where(inArray(schema.skillPrereqs.skillSlug, skillSlugs));
  return rows;
}

/** Every edge (raw) — for cycle-checking in the write path. */
export async function listAllPrereqEdges(): Promise<PrereqEdge[]> {
  const db = getDb();
  return db
    .select({
      skillSlug: schema.skillPrereqs.skillSlug,
      prereqSkillSlug: schema.skillPrereqs.prereqSkillSlug,
    })
    .from(schema.skillPrereqs);
}

export interface AdminPrereqRow {
  skillSlug: string;
  skillLabel: string;
  prereqSkillSlug: string;
  prereqLabel: string;
  reason: string;
}

/** Every edge with both skill labels resolved — for the admin surface. */
export async function listAllPrereqsAdmin(): Promise<AdminPrereqRow[]> {
  const db = getDb();
  const skillTbl = schema.skills;
  const rows = await db
    .select({
      skillSlug: schema.skillPrereqs.skillSlug,
      skillLabel: skillTbl.label,
      prereqSkillSlug: schema.skillPrereqs.prereqSkillSlug,
      reason: schema.skillPrereqs.reason,
    })
    .from(schema.skillPrereqs)
    .innerJoin(skillTbl, eq(skillTbl.slug, schema.skillPrereqs.skillSlug))
    .orderBy(asc(schema.skillPrereqs.skillSlug));

  // Resolve prereq labels in a second pass (avoids a self-join alias).
  const prereqSlugs = Array.from(new Set(rows.map((r) => r.prereqSkillSlug)));
  const labelRows = prereqSlugs.length
    ? await db
        .select({ slug: skillTbl.slug, label: skillTbl.label })
        .from(skillTbl)
        .where(inArray(skillTbl.slug, prereqSlugs))
    : [];
  const labelBySlug = new Map(labelRows.map((r) => [r.slug, r.label]));

  return rows.map((r) => ({
    skillSlug: r.skillSlug,
    skillLabel: r.skillLabel,
    prereqSkillSlug: r.prereqSkillSlug,
    prereqLabel: labelBySlug.get(r.prereqSkillSlug) ?? r.prereqSkillSlug,
    reason: r.reason,
  }));
}

// ── Phase 20.2: "Unlocks next" ───────────────────────────────────────────────

export interface UnlockedNext {
  /** The skill a prereq the seeker already holds opens up. */
  dependentSlug: string;
  dependentLabel: string;
  /** The prereq the seeker holds that unlocks it. */
  prereqLabel: string;
}

/**
 * Skills the seeker can now sensibly tackle: they hold a prerequisite but not
 * the dependent, and the dependent isn't already on their active learning list.
 * Drives the flag-gated "Unlocks next" card. Capped small (a nudge, not a list).
 */
export async function getUnlockedNextSkills(
  profileId: string,
): Promise<UnlockedNext[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT DISTINCT ON (sp.skill_slug)
      sp.skill_slug        AS dependent_slug,
      dep.label            AS dependent_label,
      pre.label            AS prereq_label
    FROM skill_prereqs sp
    JOIN profile_skills owned
      ON owned.profile_id = ${profileId}
     AND owned.skill_slug = sp.prereq_skill_slug
    JOIN skills dep ON dep.slug = sp.skill_slug
    JOIN skills pre ON pre.slug = sp.prereq_skill_slug
    WHERE sp.skill_slug NOT IN (
        SELECT skill_slug FROM profile_skills WHERE profile_id = ${profileId}
      )
      AND sp.skill_slug NOT IN (
        SELECT skill_slug FROM learning_items
        WHERE profile_id = ${profileId}
          AND state IN ('interested', 'accepted', 'in_progress')
      )
    ORDER BY sp.skill_slug
    LIMIT 3
  `);
  const rows = (
    result as unknown as {
      rows: Array<{
        dependent_slug: string;
        dependent_label: string;
        prereq_label: string;
      }>;
    }
  ).rows;
  return rows.map((r) => ({
    dependentSlug: r.dependent_slug,
    dependentLabel: r.dependent_label,
    prereqLabel: r.prereq_label,
  }));
}
