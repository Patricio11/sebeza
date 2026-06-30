/**
 * Phase 19 ("Custom Skills")  read path for a seeker's self-described skills.
 * Live (non-deleted) rows only. Pure read; never joined into search.
 */

import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

/** Max self-described skills per seeker (shared by the action + the editor). */
export const MAX_CUSTOM_SKILLS = 3;

export interface CustomSkill {
  id: string;
  label: string;
  proficiency: number;
  yearsOfExperience: number | null;
}

export async function listCustomSkills(
  profileId: string,
): Promise<CustomSkill[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.profileSkillsCustom.id,
      label: schema.profileSkillsCustom.label,
      proficiency: schema.profileSkillsCustom.proficiency,
      yearsOfExperience: schema.profileSkillsCustom.yearsOfExperience,
    })
    .from(schema.profileSkillsCustom)
    .where(
      and(
        eq(schema.profileSkillsCustom.profileId, profileId),
        isNull(schema.profileSkillsCustom.deletedAt),
      ),
    )
    .orderBy(asc(schema.profileSkillsCustom.createdAt));
  return rows;
}

// ── Phase 19.2: admin canonicalization leaderboard ───────────────────────────

export interface CustomSkillAggregate {
  /** Lowercased key (groups case-variant spellings together). */
  labelNormalized: string;
  /** A display form (the most recently used spelling). */
  label: string;
  /** Distinct seekers who have this live custom skill. POPIA: count only. */
  seekerCount: number;
}

/**
 * The unindexed-custom-skill leaderboard for `/admin/custom-skills`. Aggregate
 * + anonymized (distinct seeker COUNT per label  never which seekers). Drives
 * the "promote to canonical" decision.
 */
export async function listCustomSkillLeaderboard(): Promise<
  CustomSkillAggregate[]
> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      label_normalized,
      (array_agg(label ORDER BY created_at DESC))[1] AS label,
      count(DISTINCT profile_id)::int AS seeker_count
    FROM profile_skills_custom
    WHERE deleted_at IS NULL
    GROUP BY label_normalized
    ORDER BY seeker_count DESC, label_normalized ASC
  `);
  const rows = (
    result as unknown as {
      rows: Array<{
        label_normalized: string;
        label: string;
        seeker_count: number;
      }>;
    }
  ).rows;
  return rows.map((r) => ({
    labelNormalized: r.label_normalized,
    label: r.label,
    seekerCount: r.seeker_count,
  }));
}
