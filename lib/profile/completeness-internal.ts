/**
 * Shared, session-free completeness refresh
 * (docs/SUGGESTION_APPROVAL_LOOP_PLAN.md).
 *
 * The profile editor recomputes completeness inside its own Server
 * Actions, but admin-side flows (taxonomy suggestion approval,
 * custom-skill canonicalization) also mutate a SEEKER's skills and
 * must keep the stored completeness honest - the number feeds search
 * ranking, so a stale value quietly misranks the seeker.
 *
 * Plain module (not "use server"): callers own authentication. Uses
 * the SAME shared engine (`computeCompleteness` in lib/mock/helpers)
 * as the editor, over live counts, so the two paths cannot drift.
 * Best-effort by contract: a failure returns null and the caller
 * proceeds - completeness is a derived number, never worth failing an
 * admin action over.
 */

import { and, eq, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { getDb } from "@/db/client";
import { computeCompleteness } from "@/lib/mock/helpers";

type Db = ReturnType<typeof getDb>;

export async function refreshProfileCompleteness(
  db: Db,
  profileId: string,
): Promise<number | null> {
  try {
    const profileRows = await db
      .select({ city: schema.profiles.city, bio: schema.profiles.bio })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, profileId))
      .limit(1);
    const basics = profileRows[0];
    if (!basics) return null;

    const [skillsRows, customSkillRows, expRows, qualsRows] =
      await Promise.all([
        db
          .select({ slug: schema.profileSkills.skillSlug })
          .from(schema.profileSkills)
          .where(eq(schema.profileSkills.profileId, profileId)),
        db
          .select({ id: schema.profileSkillsCustom.id })
          .from(schema.profileSkillsCustom)
          .where(
            and(
              eq(schema.profileSkillsCustom.profileId, profileId),
              isNull(schema.profileSkillsCustom.deletedAt),
            ),
          ),
        db
          .select({ id: schema.experiences.id })
          .from(schema.experiences)
          .where(eq(schema.experiences.profileId, profileId)),
        db
          .select({ id: schema.qualifications.id })
          .from(schema.qualifications)
          .where(eq(schema.qualifications.profileId, profileId)),
      ]);

    const completeness = computeCompleteness({
      city: basics.city,
      bio: basics.bio ?? "",
      topSkills: [
        ...skillsRows.map((r) => ({ name: r.slug, proficiency: 3 as const })),
        ...customSkillRows.map((_, i) => ({
          name: `custom-${i}`,
          proficiency: 3 as const,
        })),
      ],
      experience: expRows.map(() => ({
        role: "",
        organization: "",
        city: "",
        startedAt: "",
        endedAt: null,
      })),
      qualifications: qualsRows.map(() => ({
        title: "",
        institution: "",
        awardedYear: null,
        verification: "unverified",
      })),
    });

    await db
      .update(schema.profiles)
      .set({ completeness })
      .where(eq(schema.profiles.id, profileId));

    return completeness;
  } catch {
    return null;
  }
}
