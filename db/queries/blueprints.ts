/**
 * Role blueprint reads (docs/ROLE_BLUEPRINTS_PLAN.md). DB first, starter
 * catalogue as the empty-profession fallback (same standing as the
 * taxonomy constants). One indexed query per call.
 */

import { asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { PROFESSIONS } from "@/lib/mock/taxonomy";
import {
  starterBlueprintFor,
  type BlueprintRow,
  type BlueprintTier,
} from "@/lib/blueprints/catalogue";

export async function getBlueprintRows(
  professionSlug: string,
): Promise<{ rows: BlueprintRow[]; source: "db" | "starter" }> {
  const db = getDb();
  const rows = await db
    .select({
      skillSlug: schema.professionSkillBlueprints.skillSlug,
      tier: schema.professionSkillBlueprints.tier,
      track: schema.professionSkillBlueprints.track,
      proveIt: schema.professionSkillBlueprints.proveIt,
    })
    .from(schema.professionSkillBlueprints)
    .where(eq(schema.professionSkillBlueprints.professionSlug, professionSlug))
    .orderBy(asc(schema.professionSkillBlueprints.tier));
  if (rows.length > 0) {
    return {
      source: "db",
      rows: rows.map((r) => ({
        professionSlug,
        skillSlug: r.skillSlug,
        tier: r.tier as BlueprintTier,
        track: r.track,
        proveIt: r.proveIt,
      })),
    };
  }
  return { source: "starter", rows: starterBlueprintFor(professionSlug) };
}

/** profiles.profession stores the LABEL; blueprints key by slug. */
export async function professionSlugForLabel(
  label: string,
): Promise<string | null> {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return null;
  const constant = PROFESSIONS.find(
    (p) => p.slug === wanted || p.label.toLowerCase() === wanted,
  );
  if (constant) return constant.slug;
  const rows = await getDb()
    .select({ slug: schema.professions.slug })
    .from(schema.professions)
    .where(sql`lower(${schema.professions.label}) = ${wanted}`)
    .limit(1);
  return rows[0]?.slug ?? null;
}

/** Admin listing: professions with their live row counts. */
export async function listBlueprintCoverage(): Promise<
  Array<{ slug: string; label: string; dbRows: number; starterRows: number }>
> {
  const db = getDb();
  const [professions, counts] = await Promise.all([
    db
      .select({
        slug: schema.professions.slug,
        label: schema.professions.label,
      })
      .from(schema.professions),
    db
      .select({
        slug: schema.professionSkillBlueprints.professionSlug,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(schema.professionSkillBlueprints)
      .groupBy(schema.professionSkillBlueprints.professionSlug),
  ]);
  const countBySlug = new Map(counts.map((c) => [c.slug, Number(c.n)]));
  const source = professions.length > 0 ? professions : PROFESSIONS;
  return source
    .map((p) => ({
      slug: p.slug,
      label: p.label,
      dbRows: countBySlug.get(p.slug) ?? 0,
      starterRows: starterBlueprintFor(p.slug).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Labels for a set of skill slugs (one indexed query). */
export async function getSkillLabels(
  slugs: string[],
): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await getDb()
    .select({ slug: schema.skills.slug, label: schema.skills.label })
    .from(schema.skills)
    .where(inArray(schema.skills.slug, slugs));
  return new Map(rows.map((r) => [r.slug, r.label]));
}
