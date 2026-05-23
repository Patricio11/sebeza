"use server";

/**
 * Phase 3  Experience CRUD Server Actions.
 *
 * Each action requires a signed-in seeker session and operates only on rows
 * owned by that session's profile.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const YEAR_MONTH = /^\d{4}-\d{2}$/;

const experienceSchema = z.object({
  role: z.string().min(2).max(120),
  organization: z.string().min(1).max(160),
  city: z.string().max(80).optional().nullable(),
  startedAt: z.string().regex(YEAR_MONTH, "Use YYYY-MM"),
  endedAt: z
    .string()
    .regex(YEAR_MONTH, "Use YYYY-MM")
    .nullable()
    .optional(),
  description: z.string().max(2000).optional().nullable(),
});

export async function addExperience(
  input: z.infer<typeof experienceSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the dates and try again.");
  const db = getDb();
  const profile = await ownedProfileId(db, session.id);
  if (!profile) return fail("Profile not found.");

  const v = parsed.data;
  if (v.endedAt && v.endedAt < v.startedAt) {
    return fail("End date can't be before the start date.");
  }

  const id = `exp_${randomUUID()}`;
  await db.insert(schema.experiences).values({
    id,
    profileId: profile,
    role: v.role,
    organization: v.organization,
    city: v.city ?? null,
    startedAt: v.startedAt,
    endedAt: v.endedAt ?? null,
    description: v.description ?? null,
  });

  await logAccess({
    kind: "profile.experience.add",
    actor: session.id,
    subject: id,
  });

  revalidatePath("/dashboard/experience");
  revalidatePath("/dashboard");
  return ok({ id });
}

const updateExperienceSchema = experienceSchema.extend({
  id: z.string().min(1),
});

export async function updateExperience(
  input: z.infer<typeof updateExperienceSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = updateExperienceSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the dates and try again.");
  const db = getDb();
  const profile = await ownedProfileId(db, session.id);
  if (!profile) return fail("Profile not found.");

  const v = parsed.data;
  if (v.endedAt && v.endedAt < v.startedAt) {
    return fail("End date can't be before the start date.");
  }

  const result = await db
    .update(schema.experiences)
    .set({
      role: v.role,
      organization: v.organization,
      city: v.city ?? null,
      startedAt: v.startedAt,
      endedAt: v.endedAt ?? null,
      description: v.description ?? null,
    })
    .where(
      and(
        eq(schema.experiences.id, v.id),
        eq(schema.experiences.profileId, profile),
      ),
    );
  void result;

  await logAccess({
    kind: "profile.experience.update",
    actor: session.id,
    subject: v.id,
  });

  revalidatePath("/dashboard/experience");
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  if (!id) return fail("Missing experience id.");
  const db = getDb();
  const profile = await ownedProfileId(db, session.id);
  if (!profile) return fail("Profile not found.");

  await db
    .delete(schema.experiences)
    .where(
      and(
        eq(schema.experiences.id, id),
        eq(schema.experiences.profileId, profile),
      ),
    );

  await logAccess({
    kind: "profile.experience.delete",
    actor: session.id,
    subject: id,
  });

  revalidatePath("/dashboard/experience");
  revalidatePath("/dashboard");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getDb>;

async function ownedProfileId(db: Db, userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}
