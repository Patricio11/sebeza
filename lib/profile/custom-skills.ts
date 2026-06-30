"use server";

/**
 * Phase 19 ("Custom Skills")  add / remove a self-described skill outside the
 * controlled taxonomy. Gated by `feature_flag_seeker_custom_skills`. Honesty +
 * privacy spine: self-attested only, capped at 3 per seeker, NEVER searchable
 * (no FK to `skills`; the search path never reads this table)  but they DO
 * count toward profile completeness and feed the admin canonicalization signal.
 */

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";
import { computeCompleteness } from "@/lib/mock/helpers";

export const MAX_CUSTOM_SKILLS = 3;
const LABEL_MAX = 60;

export type CustomSkillResult = { ok: true } | { ok: false; error: string };

type Db = ReturnType<typeof getDb>;

function normalize(label: string): { display: string; normalized: string } {
  const display = (label ?? "").trim().replace(/\s+/g, " ").slice(0, LABEL_MAX);
  return { display, normalized: display.toLowerCase() };
}

async function loadProfile(db: Db, userId: string) {
  const [p] = await db
    .select({
      id: schema.profiles.id,
      city: schema.profiles.city,
      bio: schema.profiles.bio,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return p ?? null;
}

/** Recompute + persist completeness (custom skills count toward it). */
async function recompute(
  db: Db,
  profileId: string,
  city: string,
  bio: string,
): Promise<void> {
  try {
    const [skills, custom, exp, quals] = await Promise.all([
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
    const value = computeCompleteness({
      city,
      bio,
      topSkills: [...skills, ...custom].map(() => ({
        name: "skill",
        proficiency: 3 as const,
      })),
      experience: exp.map(() => ({
        role: "",
        organization: "",
        city: "",
        startedAt: "",
        endedAt: null,
      })),
      qualifications: quals.map(() => ({
        title: "",
        institution: "",
        awardedYear: null,
        verification: "unverified" as const,
      })),
    });
    await db
      .update(schema.profiles)
      .set({ completeness: value })
      .where(eq(schema.profiles.id, profileId));
  } catch {
    /* best-effort  leave the stored number as-is */
  }
}

export async function addCustomSkill(
  rawLabel: string,
  proficiency: number,
  years?: number | null,
): Promise<CustomSkillResult> {
  const enabled = await getSetting<boolean>("feature_flag_seeker_custom_skills");
  if (!enabled) return { ok: false, error: "Custom skills aren't available." };

  const session = await verifyRole("seeker");
  const db = getDb();
  const profile = await loadProfile(db, session.id);
  if (!profile) return { ok: false, error: "Profile not found." };

  const { display, normalized } = normalize(rawLabel);
  if (display.length < 2) return { ok: false, error: "Skill name is too short." };
  const prof = Math.max(1, Math.min(5, Math.round(proficiency)));
  const yrs =
    years == null ? null : Math.max(0, Math.min(60, Math.round(years)));

  // Push canonical skills to the taxonomy picker instead.
  const canonical = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills)
    .where(sql`lower(${schema.skills.label}) = ${normalized}`)
    .limit(1);
  if (canonical.length > 0) {
    return {
      ok: false,
      error: "That's already a standard skill — add it from the picker above.",
    };
  }

  // Cap + duplicate check over LIVE rows.
  const live = await db
    .select({ normalized: schema.profileSkillsCustom.labelNormalized })
    .from(schema.profileSkillsCustom)
    .where(
      and(
        eq(schema.profileSkillsCustom.profileId, profile.id),
        isNull(schema.profileSkillsCustom.deletedAt),
      ),
    );
  if (live.some((r) => r.normalized === normalized)) {
    return { ok: false, error: "You've already added that skill." };
  }
  if (live.length >= MAX_CUSTOM_SKILLS) {
    return {
      ok: false,
      error: `You can add up to ${MAX_CUSTOM_SKILLS} custom skills.`,
    };
  }

  const id = `psc_${randomUUID()}`;
  await db.insert(schema.profileSkillsCustom).values({
    id,
    profileId: profile.id,
    label: display,
    labelNormalized: normalized,
    proficiency: prof,
    yearsOfExperience: yrs,
  });

  await logAccess({
    kind: "profile.custom_skill.add",
    actor: profile.id,
    subject: id,
    meta: { label: normalized, proficiency: prof },
  });
  await recompute(db, profile.id, profile.city, profile.bio ?? "");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeCustomSkill(
  id: string,
): Promise<CustomSkillResult> {
  const session = await verifyRole("seeker");
  const db = getDb();
  const profile = await loadProfile(db, session.id);
  if (!profile) return { ok: false, error: "Profile not found." };

  const [row] = await db
    .select({ id: schema.profileSkillsCustom.id })
    .from(schema.profileSkillsCustom)
    .where(
      and(
        eq(schema.profileSkillsCustom.id, id),
        eq(schema.profileSkillsCustom.profileId, profile.id),
        isNull(schema.profileSkillsCustom.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "Skill not found." };

  await db
    .update(schema.profileSkillsCustom)
    .set({ deletedAt: new Date() })
    .where(eq(schema.profileSkillsCustom.id, id));

  await logAccess({
    kind: "profile.custom_skill.remove",
    actor: profile.id,
    subject: id,
  });
  await recompute(db, profile.id, profile.city, profile.bio ?? "");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
