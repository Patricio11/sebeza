"use server";

/**
 * Phase 19.2 ("Custom Skills  canonicalization")  promote a frequently-claimed
 * custom label into a canonical `skills` slug, migrating every live
 * `profile_skills_custom` row carrying that normalized label into
 * `profile_skills` at the seeker's own self-attested proficiency / years. The
 * promoted skill is brand-new, so no seeker can already hold it (no conflict);
 * the existing `profile_skills` trigger refreshes each affected profile's
 * search vector, so those seekers become searchable for the skill immediately.
 *
 * Admin-gated, audited (`admin.custom_skill.canonicalize`), POPIA-safe (the
 * action operates on a label, never on a named seeker).
 */

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type CanonicalizeResult =
  | { ok: true; slug: string; migrated: number }
  | { ok: false; error: string };

const input = z.object({
  labelNormalized: z.string().trim().min(2).max(60),
  label: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase-with-hyphens."),
});

export async function canonicalizeCustomSkill(
  raw: z.input<typeof input>,
): Promise<CanonicalizeResult> {
  const admin = await verifyAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const { labelNormalized, label, slug } = parsed.data;

  const db = getDb();

  // Slug must be free.
  const existing = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills)
    .where(eq(schema.skills.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "That skill slug already exists." };
  }

  // The live custom rows carrying this label.
  const customRows = await db
    .select({
      id: schema.profileSkillsCustom.id,
      profileId: schema.profileSkillsCustom.profileId,
      proficiency: schema.profileSkillsCustom.proficiency,
      yearsOfExperience: schema.profileSkillsCustom.yearsOfExperience,
    })
    .from(schema.profileSkillsCustom)
    .where(
      and(
        eq(schema.profileSkillsCustom.labelNormalized, labelNormalized),
        isNull(schema.profileSkillsCustom.deletedAt),
      ),
    );

  await db.transaction(async (tx) => {
    // 1. Create the canonical skill.
    await tx.insert(schema.skills).values({ slug, label });

    // 2. Migrate each holder into profile_skills (self-attested; the new slug
    //    can't collide with an existing row for that seeker).
    if (customRows.length > 0) {
      await tx.insert(schema.profileSkills).values(
        customRows.map((r) => ({
          profileId: r.profileId,
          skillSlug: slug,
          proficiency: r.proficiency,
          yearsOfExperience: r.yearsOfExperience,
          provenance: "self_attested" as const,
        })),
      );
      // 3. Retire the custom rows (soft-delete).
      const now = new Date();
      for (const r of customRows) {
        await tx
          .update(schema.profileSkillsCustom)
          .set({ deletedAt: now })
          .where(eq(schema.profileSkillsCustom.id, r.id));
      }
    }
  });

  await logAccess({
    kind: "admin.custom_skill.canonicalize",
    actor: admin.id,
    subject: slug,
    meta: { labelNormalized, migrated: customRows.length },
  });

  revalidatePath("/admin/custom-skills");
  revalidatePath("/admin/taxonomy");
  revalidatePath("/dashboard/profile");
  return { ok: true, slug, migrated: customRows.length };
}
