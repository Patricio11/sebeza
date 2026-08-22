"use server";

/**
 * Interview scheduling, employer side (docs/INTERVIEWS_PLAN.md).
 *
 * accepted -> scheduled -> confirmed/declined (seeker) or cancelled
 * (employer) -> attended/no_show (employer, after the start time).
 *
 * One ACTIVE interview (scheduled|confirmed) per invitation, enforced
 * by the partial unique index `interviews_one_active_per_invitation`,
 * so two tabs racing cannot double-book a person: the second insert
 * fails at the database, not in application hope.
 */

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";
import { formatSaDateTime } from "@/lib/interviews/links";
import { verifyOrgVerified } from "@/lib/auth/dal";
import { getMyOrgRole } from "./vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import type { ActionResult } from "./invitations";

/** Same posture as the invitations module's own copy: Owner/Recruiter
 *  in a verified org. Private on purpose; exporting it from a
 *  "use server" module would mint a public endpoint. */
async function requireEditRole(): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; message: string }
> {
  const session = await verifyOrgVerified();
  if (!session.orgId) return { ok: false, message: "No organisation context." };
  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    return {
      ok: false,
      message:
        "Your role is read-only for vacancies. Ask an Owner or Recruiter to schedule interviews.",
    };
  }
  return { ok: true, orgId: session.orgId, userId: session.id };
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}

const ACCEPTED = ["accepted", "accepted_with_notice"] as const;

const detailsSchema = z.object({
  /** UTC instant, built client-side from SA wall-clock inputs. */
  startsAtIso: z.string().datetime(),
  durationMinutes: z.union([
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
  ]),
  locationKind: z.enum(["in_person", "video", "phone"]),
  location: z.string().trim().min(3).max(300),
  instructions: z.string().trim().max(500).optional(),
});

const scheduleSchema = detailsSchema.extend({
  invitationId: z.string().min(1),
});
const bulkSchema = detailsSchema.extend({
  vacancyId: z.string().min(1),
});

interface InvitationTarget {
  invitationId: string;
  vacancyId: string;
  vacancyTitle: string;
  organizationId: string;
  orgName: string;
  profileId: string;
  profileUserId: string;
  state: string;
}

async function loadTargets(
  where: ReturnType<typeof eq> | ReturnType<typeof and>,
): Promise<InvitationTarget[]> {
  const db = getDb();
  const rows = await db
    .select({
      invitationId: schema.vacancyInvitations.id,
      vacancyId: schema.vacancyInvitations.vacancyId,
      state: schema.vacancyInvitations.state,
      vacancyTitle: schema.vacancies.title,
      organizationId: schema.vacancies.organizationId,
      orgName: schema.organizations.name,
      profileId: schema.vacancyInvitations.profileId,
      profileUserId: schema.profiles.userId,
    })
    .from(schema.vacancyInvitations)
    .innerJoin(
      schema.vacancies,
      eq(schema.vacancies.id, schema.vacancyInvitations.vacancyId),
    )
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.vacancies.organizationId),
    )
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.vacancyInvitations.profileId),
    )
    .where(where);
  return rows as InvitationTarget[];
}

/** The scheduled-time guard: interviews live in the future. Ten
 *  minutes of grace absorbs clock skew and "starting right now". */
function startsInFuture(startsAt: Date): boolean {
  return startsAt.getTime() > Date.now() - 10 * 60 * 1000;
}

/** Walks the error's cause chain looking for the one-active unique
 *  index, by constraint name or message, on any driver. */
function isOneActiveViolation(e: unknown): boolean {
  let err: unknown = e;
  for (let depth = 0; depth < 5 && err && typeof err === "object"; depth++) {
    const any = err as {
      message?: string;
      constraint_name?: string;
      cause?: unknown;
    };
    if (any.constraint_name === "interviews_one_active_per_invitation") return true;
    if (
      typeof any.message === "string" &&
      any.message.includes("interviews_one_active_per_invitation")
    ) {
      return true;
    }
    err = any.cause;
  }
  return false;
}

async function insertInterview(
  target: InvitationTarget,
  details: z.infer<typeof detailsSchema>,
  scheduledByUserId: string,
): Promise<"scheduled" | "already_active"> {
  const db = getDb();
  try {
    await db.insert(schema.interviews).values({
      id: `int_${randomUUID()}`,
      invitationId: target.invitationId,
      vacancyId: target.vacancyId,
      organizationId: target.organizationId,
      profileId: target.profileId,
      scheduledByUserId,
      startsAt: new Date(details.startsAtIso),
      durationMinutes: details.durationMinutes,
      locationKind: details.locationKind,
      location: details.location,
      instructions: details.instructions?.length ? details.instructions : null,
    });
  } catch (e) {
    // The partial unique index: an active interview already exists.
    // Drizzle wraps the driver error ("Failed query: ..."), so the
    // constraint name lives on the CAUSE chain, not the top message.
    if (isOneActiveViolation(e)) {
      return "already_active";
    }
    throw e;
  }

  const when = formatSaDateTime(new Date(details.startsAtIso));
  await createNotification({
    userId: target.profileUserId,
    kind: "interview.scheduled",
    title: `Interview: ${target.vacancyTitle} at ${target.orgName}`,
    body: `${when} (SA time) · ${details.location}${details.instructions ? ` · ${details.instructions}` : ""}`,
    link: `/dashboard/invitations/${target.invitationId}`,
    meta: {
      invitationId: target.invitationId,
      vacancyId: target.vacancyId,
      startsAtIso: details.startsAtIso,
      durationMinutes: details.durationMinutes,
      locationKind: details.locationKind,
      location: details.location,
      instructions: details.instructions ?? null,
      orgName: target.orgName,
      vacancyTitle: target.vacancyTitle,
      notePii: true,
    },
  });
  return "scheduled";
}

/** Schedule ONE accepted invitee. */
export async function scheduleInterview(
  input: z.infer<typeof scheduleSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid interview details.");
  }
  if (!startsInFuture(new Date(parsed.data.startsAtIso))) {
    return fail("Pick a time in the future.");
  }

  const targets = await loadTargets(
    eq(schema.vacancyInvitations.id, parsed.data.invitationId),
  );
  const t = targets[0];
  if (!t || t.organizationId !== guard.orgId) return fail("Invitation not found.");
  if (!ACCEPTED.includes(t.state as (typeof ACCEPTED)[number])) {
    return fail("Interviews are for accepted invitations.");
  }

  const outcome = await insertInterview(t, parsed.data, guard.userId);
  if (outcome === "already_active") {
    return fail(
      "An interview is already scheduled for this person. Cancel it first to pick a new time.",
    );
  }

  await logAccess({
    kind: "interview.schedule",
    actor: guard.userId,
    subject: t.invitationId,
    meta: {
      orgId: guard.orgId,
      vacancyId: t.vacancyId,
      startsAtIso: parsed.data.startsAtIso,
      notePii: true,
    },
  });
  revalidatePath(`/employer/vacancies/${t.vacancyId}`);
  revalidatePath("/employer/interviews");
  return ok();
}

/**
 * Schedule EVERY accepted invitee on a vacancy for the same slot (a
 * group session). Skips anyone who already has an active interview,
 * and reports the split honestly rather than pretending.
 */
export async function scheduleInterviewsForVacancy(
  input: z.infer<typeof bulkSchema>,
): Promise<ActionResult<{ scheduled: number; skipped: number }>> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid interview details.");
  }
  if (!startsInFuture(new Date(parsed.data.startsAtIso))) {
    return fail("Pick a time in the future.");
  }

  const targets = await loadTargets(
    and(
      eq(schema.vacancyInvitations.vacancyId, parsed.data.vacancyId),
      inArray(schema.vacancyInvitations.state, [...ACCEPTED]),
    )!,
  );
  if (targets.length === 0 || targets[0]!.organizationId !== guard.orgId) {
    return fail("No accepted invitations on this vacancy.");
  }

  let scheduled = 0;
  let skipped = 0;
  for (const t of targets) {
    const outcome = await insertInterview(t, parsed.data, guard.userId);
    if (outcome === "scheduled") scheduled++;
    else skipped++;
  }

  await logAccess({
    kind: "interview.schedule",
    actor: guard.userId,
    subject: parsed.data.vacancyId,
    meta: {
      orgId: guard.orgId,
      bulk: true,
      scheduled,
      skipped,
      startsAtIso: parsed.data.startsAtIso,
      notePii: true,
    },
  });
  revalidatePath(`/employer/vacancies/${parsed.data.vacancyId}`);
  revalidatePath("/employer/interviews");
  return ok({ scheduled, skipped });
}

const cancelSchema = z.object({
  interviewId: z.string().min(1),
});

/** Cancel a scheduled/confirmed interview. The seeker is told; a
 *  reschedule is this plus a fresh schedule. */
export async function cancelInterview(
  input: z.infer<typeof cancelSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid interview id.");

  const db = getDb();
  const rows = await db
    .select({
      id: schema.interviews.id,
      organizationId: schema.interviews.organizationId,
      state: schema.interviews.state,
      startsAt: schema.interviews.startsAt,
      vacancyId: schema.interviews.vacancyId,
      invitationId: schema.interviews.invitationId,
      profileUserId: schema.profiles.userId,
      vacancyTitle: schema.vacancies.title,
      orgName: schema.organizations.name,
    })
    .from(schema.interviews)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.interviews.profileId))
    .innerJoin(schema.vacancies, eq(schema.vacancies.id, schema.interviews.vacancyId))
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.interviews.organizationId),
    )
    .where(eq(schema.interviews.id, parsed.data.interviewId))
    .limit(1);
  const row = rows[0];
  if (!row || row.organizationId !== guard.orgId) return fail("Interview not found.");
  if (row.state !== "scheduled" && row.state !== "confirmed") {
    return fail(`This interview is already ${row.state}.`);
  }

  const updated = await db
    .update(schema.interviews)
    .set({ state: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(schema.interviews.id, row.id),
        inArray(schema.interviews.state, ["scheduled", "confirmed"]),
      ),
    )
    .returning({ id: schema.interviews.id });
  if (updated.length === 0) return fail("The interview changed in the meantime.");

  await createNotification({
    userId: row.profileUserId,
    kind: "interview.cancelled",
    title: `Interview cancelled: ${row.vacancyTitle} at ${row.orgName}`,
    body: `The interview set for ${formatSaDateTime(row.startsAt)} (SA time) was cancelled by the employer. If they pick a new time, you will be told the same way.`,
    link: `/dashboard/invitations/${row.invitationId}`,
    meta: { interviewId: row.id, vacancyId: row.vacancyId },
  });
  await logAccess({
    kind: "interview.cancel",
    actor: guard.userId,
    subject: row.id,
    meta: { orgId: guard.orgId, vacancyId: row.vacancyId },
  });
  revalidatePath(`/employer/vacancies/${row.vacancyId}`);
  revalidatePath("/employer/interviews");
  return ok();
}

const attendanceSchema = z.object({
  interviewId: z.string().min(1),
  attended: z.boolean(),
});

/**
 * Record who actually came. Only after the start time: attendance is a
 * fact about the past, not a prediction. An attended interview is the
 * doorway to "Log this hire"; a no-show is recorded honestly.
 */
export async function markInterviewAttendance(
  input: z.infer<typeof attendanceSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid attendance input.");

  const db = getDb();
  const rows = await db
    .select({
      id: schema.interviews.id,
      organizationId: schema.interviews.organizationId,
      state: schema.interviews.state,
      startsAt: schema.interviews.startsAt,
      vacancyId: schema.interviews.vacancyId,
    })
    .from(schema.interviews)
    .where(eq(schema.interviews.id, parsed.data.interviewId))
    .limit(1);
  const row = rows[0];
  if (!row || row.organizationId !== guard.orgId) return fail("Interview not found.");
  if (row.state !== "scheduled" && row.state !== "confirmed") {
    return fail(`This interview is ${row.state}; attendance no longer applies.`);
  }
  if (row.startsAt.getTime() > Date.now()) {
    return fail("The interview hasn't started yet. Mark attendance afterwards.");
  }

  const next = parsed.data.attended ? "attended" : "no_show";
  await db
    .update(schema.interviews)
    .set({ state: next })
    .where(eq(schema.interviews.id, row.id));

  await logAccess({
    kind: "interview.attendance",
    actor: guard.userId,
    subject: row.id,
    meta: { orgId: guard.orgId, vacancyId: row.vacancyId, outcome: next },
  });
  revalidatePath("/employer/interviews");
  revalidatePath(`/employer/vacancies/${row.vacancyId}`);
  return ok();
}
