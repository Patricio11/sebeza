/**
 * Phase 20 ("Skill Prerequisites")  read path for the skill dependency graph.
 */

import "server-only";
import { inArray, eq, asc } from "drizzle-orm";
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
