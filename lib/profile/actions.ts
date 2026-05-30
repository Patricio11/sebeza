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
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";
import { validateSaIdNumber } from "@/lib/id-number";
import { validateDob } from "@/lib/auth/id-validation";
import { computeCompleteness } from "@/lib/mock/helpers";
import { SKILLS, PROFESSIONS } from "@/lib/mock/taxonomy";
import type { EmploymentStatus } from "@/lib/mock/types";
import { notifyAllAdmins } from "@/lib/notifications/server";

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
// updateProfileBasics  identity + professional + location + bio in one save
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
  /** Phase 9.9  total years of experience. NULL = "rather not say."
   *  Clamped 0..60 server-side; UI also clamps. */
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
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
  // Skills + experience + qualifications haven't changed in this action 
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
      yearsExperience: v.yearsExperience ?? null,
      completeness: liveCompleteness ?? newCompleteness,
    })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: session.id,
    subject: profile.id,
    meta: { fields: Object.keys(v) },
  });

  // Phase 10 follow-up  if the user picked "Other" on the profession
  // combobox, the value isn't a canonical slug. Submit a taxonomy
  // suggestion so admins can review + promote (same pattern as the
  // sign-up flow). Dedupes via the suggestion-table lookup;
  // case-insensitive against existing customText. Failure is
  // logged but doesn't tank the profile update.
  const isCanonical = PROFESSIONS.some(
    (p) => p.slug === v.profession || p.label.toLowerCase() === v.profession.toLowerCase(),
  );
  if (!isCanonical) {
    try {
      const suggestionId = `tx_${randomUUID()}`;
      await db.insert(schema.taxonomySuggestions).values({
        id: suggestionId,
        kind: "profession",
        customText: v.profession,
        submittedByUserId: session.id,
      });
      await logAccess({
        kind: "taxonomy.suggestion.submit",
        actor: session.id,
        subject: suggestionId,
        meta: { kind: "profession", customText: v.profession, via: "profile-editor" },
      });
      await notifyAllAdmins({
        kind: "taxonomy.suggestion.received",
        title: `New profession suggestion: ${v.profession}`,
        body: `A seeker picked "Other" on their profile + entered "${v.profession}". Review at /admin/taxonomy.`,
        link: "/admin/taxonomy",
        dedupeKey: `profession::${v.profession.toLowerCase()}`,
        meta: { suggestionId, kind: "profession", customText: v.profession },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[profile] profession suggestion submit failed:", e);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11.2.8  switch primary profession (Career-Compass pivot CTA).
//
// Lightweight single-field action used by the AdjacentProfessionCard
// modal. Keeps the modal client logic small: it doesn't have to
// re-supply the full basics payload, which would couple the pivot UI
// to every column of the basics form. Audits as `profile.update` with
// a `pivot: true` meta flag so the audit trail distinguishes a
// deliberate profession switch from a routine basics save.
// ─────────────────────────────────────────────────────────────────────────────

const switchProfessionSchema = z.object({
  profession: z.string().min(2).max(80),
});

export async function switchPrimaryProfession(
  input: z.infer<typeof switchProfessionSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = switchProfessionSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a valid profession.");

  const db = getDb();
  const rows = await db
    .select({
      id: schema.profiles.id,
      handle: schema.profiles.handle,
      profession: schema.profiles.profession,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = rows[0];
  if (!profile) return fail("Profile not found.");

  const next = parsed.data.profession.trim();
  if (next.toLowerCase() === profile.profession.toLowerCase()) {
    return ok();
  }

  await db
    .update(schema.profiles)
    .set({ profession: next })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: session.id,
    subject: profile.id,
    meta: {
      fields: ["profession"],
      pivot: true,
      previousProfession: profile.profession,
      newProfession: next,
    },
  });

  // Pivot reshapes the seeker's pool: rank, recommendations, learning
  // paths, every search-event-driven surface needs to recompute. Same
  // revalidation set as updateSkills (Phase 11.2.7) + the public
  // profile page where the new profession surfaces.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/grow");
  revalidatePath(`/p/${profile.handle}`);
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSkills  replaces the set in a transaction
// ─────────────────────────────────────────────────────────────────────────────

const skillsSchema = z.object({
  skills: z
    .array(
      z.object({
        slug: z.string().min(1),
        proficiency: z.number().int().min(1).max(5),
        /** Phase 9.9  per-skill years of experience. NULL = "rather not say."
         *  Clamped 0..60 server-side; UI also clamps. */
        yearsOfExperience: z.number().int().min(0).max(60).nullable().optional(),
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
  if (!parsed.success) return fail("Skill list invalid  try again.");
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  // Phase 10 follow-up  the multi-select skill picker can emit "Other"
  // suggestions (free-text not in the canonical taxonomy). Split them:
  // canonical skills land in profile_skills (matcher-visible); pending
  // ones go to the admin taxonomy queue + are dropped from this save.
  // The seeker UI shows them as "pending" chips client-side; on
  // reload they fall off the profile until admin promotes them.
  const validSlugs = new Set(SKILLS.map((s) => s.slug));
  const canonicalSkills = parsed.data.skills.filter((s) =>
    validSlugs.has(s.slug),
  );
  const pendingSkills = parsed.data.skills.filter(
    (s) => !validSlugs.has(s.slug),
  );

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.profileSkills)
      .where(eq(schema.profileSkills.profileId, profile.id));
    if (canonicalSkills.length > 0) {
      await tx.insert(schema.profileSkills).values(
        canonicalSkills.map((s) => ({
          profileId: profile.id,
          skillSlug: s.slug,
          proficiency: s.proficiency,
          yearsOfExperience: s.yearsOfExperience ?? null,
        })),
      );
    }
  });

  // Submit taxonomy suggestions for the pending entries. Auxiliary
  // failure logs but doesn't tank the parent save. Same pattern as
  // the profession suggestion path in updateProfileBasics.
  for (const s of pendingSkills) {
    try {
      const suggestionId = `tx_${randomUUID()}`;
      await db.insert(schema.taxonomySuggestions).values({
        id: suggestionId,
        kind: "skill",
        customText: s.slug,
        submittedByUserId: session.id,
      });
      await logAccess({
        kind: "taxonomy.suggestion.submit",
        actor: session.id,
        subject: suggestionId,
        meta: { kind: "skill", customText: s.slug, via: "profile-editor" },
      });
      await notifyAllAdmins({
        kind: "taxonomy.suggestion.received",
        title: `New skill suggestion: ${s.slug}`,
        body: `A seeker picked "Other" on their skill picker + entered "${s.slug}". Review at /admin/taxonomy.`,
        link: "/admin/taxonomy",
        dedupeKey: `skill::${s.slug.toLowerCase()}`,
        meta: { suggestionId, kind: "skill", customText: s.slug },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[skills] suggestion submit failed:", e);
    }
  }

  await logAccess({
    kind: "profile.skills.update",
    actor: session.id,
    subject: profile.id,
    meta: { count: parsed.data.skills.length },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  // Phase 11.2.7  Career Compass reads from profile_skills + the
  // ranking SQL; without this revalidation the seeker can mutate
  // skills and still see the old recommendation set on /dashboard/grow
  // until the default cache invalidates. Cheap; closes a correctness
  // gap.
  revalidatePath("/dashboard/grow");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7.5  Work-availability (independent of employment status)
// ─────────────────────────────────────────────────────────────────────────────

const WORK_AVAILABILITY_VALUES = [
  "casual",
  "part_time",
  "contract",
  "full_time",
  // Phase 9.18  work-mode values share the enum with employment-type.
  "remote",
  "hybrid",
  // Phase 9.21  recurring calendar-window work.
  "seasonal",
] as const;

const workAvailabilitySchema = z.object({
  values: z.array(z.enum(WORK_AVAILABILITY_VALUES)).max(7),
});

export async function updateWorkAvailability(
  input: z.infer<typeof workAvailabilitySchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = workAvailabilitySchema.safeParse(input);
  if (!parsed.success) return fail("Pick from the listed work kinds.");
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  // De-dupe + preserve canonical order so two seekers with the same
  // set end up with byte-identical column values (helps GIN cardinality).
  const dedup = Array.from(new Set(parsed.data.values)) as typeof parsed.data.values;
  const ordered = WORK_AVAILABILITY_VALUES.filter((k) => dedup.includes(k));

  await db
    .update(schema.profiles)
    .set({ workAvailability: ordered })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: session.id,
    subject: profile.id,
    meta: { field: "workAvailability", count: ordered.length },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath(`/p/${profile.handle}`);
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
        ? "That ID number's checksum doesn't match  please double-check."
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.16  Date of Birth (captured at sign-up; editable from profile)
// ─────────────────────────────────────────────────────────────────────────────

const dobSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
});

/**
 * Update the seeker's date of birth from /dashboard/profile.
 *
 * Phase 9.16 captures DOB at sign-up; this surface lets a seeker fix
 * a typo. The 14100 window is enforced server-side via
 * `validateDob` so a tampered request can't backdoor through the
 * Server Action.
 *
 * We deliberately do NOT cross-check the SA ID prefix here  the SA ID
 * is encrypted at-rest and decrypting it on every DOB edit just to
 * cross-check would create needless decrypt audit events. The next
 * KYC review surfaces any mismatch from the document itself.
 */
export async function updateMyDateOfBirth(
  input: z.infer<typeof dobSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = dobSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid date.");
  }
  const dobCheck = validateDob(parsed.data.dateOfBirth);
  if (!dobCheck.ok) return fail(dobCheck.message);

  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({ dateOfBirth: parsed.data.dateOfBirth })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: session.id,
    subject: profile.id,
    meta: { fields: ["dateOfBirth"] },
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
// Phase 7.5  Seeker self-reported placement.
//
// Softer signal than the employer-confirmed `markAsHired` flow. Stored
// in the same `placements` table with `source = 'seeker_reported'` so
// it can be displayed on the seeker's own profile flagged as such, but
// is excluded from the 7.5.4 outcomes dataset and from any "national
// placements" aggregate. Placement-Truth Rule intact.
// ─────────────────────────────────────────────────────────────────────────────

const selfReportPlacementSchema = z.object({
  organizationName: z.string().min(2).max(200),
  role: z.string().min(2).max(120),
  city: z.string().min(1).max(120),
  /** ISO yyyy-mm-dd. Defaults to today. */
  hiredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function selfReportPlacement(
  input: z.infer<typeof selfReportPlacementSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = selfReportPlacementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const db = getDb();
  const profile = await loadOwnedProfile(db, session.id);
  if (!profile) return fail("Profile not found.");

  // Stub org row: seeker self-reports don't go through the employer-
  // verification flow, so we attach to a synthetic organization with
  // `verification = 'unverified'` for trace-ability. If the org name
  // matches an existing organization, reuse that id.
  const existingOrg = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.name, parsed.data.organizationName))
    .limit(1);

  let organizationId: string;
  if (existingOrg[0]) {
    organizationId = existingOrg[0].id;
  } else {
    organizationId = `org_self_${randomUUID()}`;
    await db.insert(schema.organizations).values({
      id: organizationId,
      name: parsed.data.organizationName,
      verification: "unverified",
    });
  }

  const placementId = `plc_${randomUUID()}`;
  const hiredAt = parsed.data.hiredAt
    ? new Date(parsed.data.hiredAt)
    : new Date();

  await db.insert(schema.placements).values({
    id: placementId,
    profileId: profile.id,
    organizationId,
    actorUserId: session.id,
    role: parsed.data.role,
    city: parsed.data.city,
    hiredAt,
    source: "seeker_reported",
  });

  await logAccess({
    kind: "placement.self_report",
    actor: session.id,
    subject: profile.id,
    meta: {
      placementId,
      organizationName: parsed.data.organizationName,
      role: parsed.data.role,
      city: parsed.data.city,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/p/${profile.handle}`);
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getDb>;

async function loadOwnedProfile(db: Db, userId: string) {
  const rows = await db
    .select({ id: schema.profiles.id, handle: schema.profiles.handle })
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
