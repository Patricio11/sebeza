/**
 * Phase 19 ("Custom Skills")  read path for a seeker's self-described skills.
 * Live (non-deleted) rows only. Pure read; never joined into search.
 */

import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

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
