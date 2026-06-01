"use server";

/**
 * Phase 13.4  self-declared student-milestone Server Actions.
 *
 * The platform auto-derives most progression events (qualifications,
 * placements, completed learning items, academic_profiles year).
 * This action covers the fifth source: milestones the platform
 * can't see  dissertation submission, graduation date confirmed,
 * first job offer accepted, studies paused.
 *
 * Honesty contract:
 *
 *   - Self-declared milestones never surface on the PUBLIC profile.
 *     The /p/<handle> renderer does not read this table.
 *   - A 'first_job_accepted' milestone does NOT flip placements to
 *     employer_confirmed (Verification-Honesty Rule). Only employer
 *     Mark-as-Hired does that.
 *   - One-shot uniqueness for each kind except 'other' is enforced
 *     by a partial unique index in migration 0046; the action also
 *     refuses up-front with a clearer error message.
 */

import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

export type MilestoneActionResult =
  | { ok: true; rowId?: string }
  | { ok: false; message: string };

const MILESTONE_NOTE_MAX = 200;
const ONE_SHOT_KINDS = new Set([
  "dissertation_submitted",
  "graduation_confirmed",
  "first_job_accepted",
  "studies_paused",
]);

const addSchema = z.object({
  kind: z.enum([
    "dissertation_submitted",
    "graduation_confirmed",
    "first_job_accepted",
    "studies_paused",
    "other",
  ]),
  /** ISO yyyy-mm-dd date. The matcher narrows on Date.parse below. */
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  note: z
    .string()
    .max(MILESTONE_NOTE_MAX)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function addStudentMilestone(
  input: z.infer<typeof addSchema>,
): Promise<MilestoneActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;

  // Reject obviously-bogus future dates (graduation 5 years out is
  // a typo; first_job_accepted in 2030 is wrong). Today is the
  // far edge of plausible for most kinds; 'graduation_confirmed'
  // and 'other' can sit up to a year ahead.
  const occurred = Date.parse(data.occurredOn);
  if (Number.isNaN(occurred)) {
    return { ok: false, message: "Date is not parseable." };
  }
  const today = Date.now();
  const oneYear = 365 * 24 * 3600 * 1000;
  const futureLimit =
    data.kind === "graduation_confirmed" || data.kind === "other"
      ? today + oneYear
      : today + 7 * 24 * 3600 * 1000;
  if (occurred > futureLimit) {
    return {
      ok: false,
      message: "Date is too far in the future for that milestone.",
    };
  }

  const db = getDb();
  const profileRows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return { ok: false, message: "Profile not found." };

  // Pre-flight one-shot check for friendlier error messages. The
  // partial unique index in 0046 is the safety net if a race
  // sneaks past this check.
  if (ONE_SHOT_KINDS.has(data.kind)) {
    const existing = await db
      .select({ id: schema.studentMilestones.id })
      .from(schema.studentMilestones)
      .where(
        and(
          eq(schema.studentMilestones.profileId, profile.id),
          eq(schema.studentMilestones.kind, data.kind),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return {
        ok: false,
        message:
          "That milestone is already on your timeline. Remove it first to re-declare.",
      };
    }
  }

  const rowId = `sm_${randomBytes(10).toString("hex")}`;
  await db.insert(schema.studentMilestones).values({
    id: rowId,
    profileId: profile.id,
    kind: data.kind,
    occurredOn: data.occurredOn,
    note: data.note?.trim() || null,
  });

  await logAccess({
    kind: "student.milestone.added",
    actor: session.id,
    subject: rowId,
    meta: {
      kind: data.kind,
      occurredOn: data.occurredOn,
      noteLength: data.note?.length ?? 0,
    },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true, rowId };
}

const removeSchema = z.object({
  rowId: z.string().min(1).max(80),
});

export async function removeStudentMilestone(
  input: z.infer<typeof removeSchema>,
): Promise<MilestoneActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid row id." };

  const db = getDb();
  const profileRows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return { ok: false, message: "Profile not found." };

  // Ownership + existence guard: only delete a row that belongs to
  // the calling seeker. The cascade FK guarantees the row is
  // deleted on account erasure, but we still own the delete here.
  const owned = await db
    .select({
      id: schema.studentMilestones.id,
      kind: schema.studentMilestones.kind,
    })
    .from(schema.studentMilestones)
    .where(
      and(
        eq(schema.studentMilestones.id, parsed.data.rowId),
        eq(schema.studentMilestones.profileId, profile.id),
      ),
    )
    .limit(1);
  const row = owned[0];
  if (!row) return { ok: false, message: "Milestone not found." };

  await db
    .delete(schema.studentMilestones)
    .where(eq(schema.studentMilestones.id, parsed.data.rowId));

  await logAccess({
    kind: "student.milestone.removed",
    actor: session.id,
    subject: parsed.data.rowId,
    meta: { kind: row.kind },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true };
}

// Marker reference so the linter doesn't strip the SQL helper while
// future read paths land.
void sql;
