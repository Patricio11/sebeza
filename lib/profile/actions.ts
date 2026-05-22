"use server";

/**
 * Phase 3 profile Server Actions.
 *
 * - updateProfileBasics: identity + location + professional + bio in one save
 * - updateSkills:        replaces the profile_skills set in a single transaction
 * - setStatus / reconfirmStatus: drives the Status-Freshness engine
 * - changeNationalId / removeNationalId: encrypted on save, never echoed back
 *
 * Every action calls `logAccess()` so the audit trail is complete.
 * Every action requires a signed-in seeker session.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";
import { validateSaIdNumber } from "@/lib/id-number";
import { computeCompleteness } from "@/lib/mock/helpers";
import { SKILLS } from "@/lib/mock/taxonomy";
import type { EmploymentStatus } from "@/lib/mock/types";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────
// updateProfileBasics — identity + professional + location + bio in one save
// ─────────────────────────────────────────────────────────────────────────────

const basicsSchema = z.object({
  displayName: z.string().min(2).max(120),
  profession: z.string().min(2).max(80),
  seniority: z
    .enum(["junior", "intermediate", "senior"])
    .nullable()
    .optional(),
  city: z.string().min(1).max(80),
  province: z.string().min(1).max(80),
  nationality: z.string().max(80).nullable().optional(),
  isCitizen: z.boolean().optional().default(false),
  bio: z.string().max(2000).optional().nullable(),
});

export async function updateProfileBasics(
  input: z.infer<typeof basicsSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = basicsSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");

  const db = getDb();
  const v = parsed.data;

  // Recompute completeness based on the new shape. Cheap; keeps the
  // ProfileCompleteness UI honest in real time.
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  const newCompleteness = computeCompleteness({
    city: v.city,
    bio: v.bio ?? "",
    topSkills: [],
    experience: [],
    qualifications: [],
  });
  // Skills + experience + qualifications haven't changed in this action —
  // we mix the old counts back in by re-reading them. (Tiny cost; keeps the
  // user's headline number accurate after every save.)
  const liveCompleteness = await recomputeCompleteness(db, profile.id, {
    city: v.city,
    bio: v.bio ?? "",
  });

  await db
    .update(schema.profiles)
    .set({
      displayName: v.displayName,
      profession: v.profession,
      seniority: v.seniority ?? null,
      city: v.city,
      province: v.province,
      nationality: v.nationality ?? null,
      isCitizen: v.isCitizen ?? false,
      bio: v.bio ?? null,
      completeness: liveCompleteness ?? newCompleteness,
    })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: session.id,
    subject: profile.id,
    meta: { fields: Object.keys(v) },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSkills — replaces the set in a transaction
// ─────────────────────────────────────────────────────────────────────────────

const skillsSchema = z.object({
  skills: z
    .array(
      z.object({
        slug: z.string().min(1),
        proficiency: z.number().int().min(1).max(5),
      }),
    )
    .max(20),
});

export async function updateSkills(
  input: z.infer<typeof skillsSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = skillsSchema.safeParse(input);
  if (!parsed.success) return fail("Skill list invalid — try again.");
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  // Validate every slug against the controlled taxonomy.
  const validSlugs = new Set(SKILLS.map((s) => s.slug));
  for (const s of parsed.data.skills) {
    if (!validSlugs.has(s.slug)) {
      return fail(`Skill "${s.slug}" isn't in the catalog yet.`);
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.profileSkills)
      .where(eq(schema.profileSkills.profileId, profile.id));
    if (parsed.data.skills.length > 0) {
      await tx.insert(schema.profileSkills).values(
        parsed.data.skills.map((s) => ({
          profileId: profile.id,
          skillSlug: s.slug,
          proficiency: s.proficiency,
        })),
      );
    }
  });

  await logAccess({
    kind: "profile.skills.update",
    actor: session.id,
    subject: profile.id,
    meta: { count: parsed.data.skills.length },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Status engine: setStatus + reconfirmStatus
// ─────────────────────────────────────────────────────────────────────────────

const EMPLOYMENT_STATUS_VALUES = [
  "employed",
  "unemployed",
  "self_employed",
  "studying",
  "open_to_work",
] as const satisfies readonly EmploymentStatus[];

const setStatusSchema = z.object({
  status: z.enum(EMPLOYMENT_STATUS_VALUES),
});

export async function setStatus(
  input: z.infer<typeof setStatusSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid status value.");
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({ status: parsed.data.status, statusConfirmedAt: new Date() })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.status.update",
    actor: session.id,
    subject: profile.id,
    meta: { status: parsed.data.status },
  });

  revalidatePath("/dashboard");
  return ok();
}

export async function reconfirmStatus(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({ statusConfirmedAt: new Date() })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.status.reconfirm",
    actor: session.id,
    subject: profile.id,
  });

  revalidatePath("/dashboard");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// National ID: encrypted on save, never echoed back
// ─────────────────────────────────────────────────────────────────────────────

const changeIdSchema = z.object({
  idNumber: z.string().min(6).max(40),
});

export async function changeNationalId(
  input: z.infer<typeof changeIdSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = changeIdSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid SA ID number.");
  const v = validateSaIdNumber(parsed.data.idNumber);
  if (!v.ok) {
    return fail(
      v.reason === "bad_checksum"
        ? "That ID number's checksum doesn't match — please double-check."
        : v.reason === "wrong_length"
          ? "An SA ID number is 13 digits."
          : v.reason === "not_digits"
            ? "Only digits, please."
            : "That doesn't look like a valid SA ID number.",
    );
  }

  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  const enc = encryptField(v.normalised);
  await db
    .update(schema.profiles)
    .set({ nationalIdEnc: enc })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.national_id.update",
    actor: session.id,
    subject: profile.id,
  });

  revalidatePath("/dashboard/profile");
  return ok();
}

export async function removeNationalId(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({ nationalIdEnc: null })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.national_id.remove",
    actor: session.id,
    subject: profile.id,
  });

  revalidatePath("/dashboard/profile");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getDb>;

async function loadOwnedProfile(db: Db, userId: string) {
  const rows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Recompute completeness using the live counts from skills/experience/quals.
 * Returns null if the join lookups fail (caller falls back to its own number).
 */
async function recomputeCompleteness(
  db: Db,
  profileId: string,
  basics: { city: string; bio: string },
): Promise<number | null> {
  try {
    const [skillsRows, expRows, qualsRows] = await Promise.all([
      db
        .select({ slug: schema.profileSkills.skillSlug })
        .from(schema.profileSkills)
        .where(eq(schema.profileSkills.profileId, profileId)),
      db
        .select({ id: schema.experiences.id })
        .from(schema.experiences)
        .where(eq(schema.experiences.profileId, profileId)),
      db
        .select({ id: schema.qualifications.id })
        .from(schema.qualifications)
        .where(eq(schema.qualifications.profileId, profileId)),
    ]);
    return computeCompleteness({
      city: basics.city,
      bio: basics.bio,
      topSkills: skillsRows.map((r) => ({ name: r.slug, proficiency: 3 })),
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
  } catch {
    return null;
  }
}
