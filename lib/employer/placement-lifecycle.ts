"use server";

/**
 * Phase 9.20 Tier 1  Placement-lifecycle read helpers.
 *
 * Distinct from the Phase 5 `lib/employer/placements.ts` (which owns
 * the *hire-time* action `markAsHired` + the `getPlacementsForVacancy`
 * vacancy-detail join). This file owns the **lifecycle** reads:
 *
 *   listEmployees      Active / Departed / All  the lifecycle list
 *   getEmployee        the per-placement detail page payload
 *
 * Tier 2 will add the write actions (confirm-still-employed, update
 * internal note); Tier 3 will add the departure capture action. Each
 * tier ships in its own commit; this file is the seam they share.
 *
 * Privacy invariant: every read filters by `organizationId` resolved
 * via `verifyEmployer()`. There is NO code path here that returns
 * placements without an org filter. Detail loads additionally
 * re-check ownership by `(placementId, organizationId)` before
 * returning  defence in depth so a leaked placementId can't smuggle
 * cross-org rows through.
 *
 * D0 reminder: this is OUTCOMES capture, not HRIS management.
 * Nothing here surfaces warnings, ratings, salary history, or any
 * other "management artefact"  the read shape is deliberately
 * narrow.
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import type { OrgMemberRole } from "@/lib/employer/vacancies-types";
// Phase 9.20  runtime label catalog + type unions live in a plain
// (non-"use server") module so client islands can import them. Next.js
// rejects non-async runtime exports from a "use server" file.
import type {
  PlacementDepartureCategory,
  PlacementLifecycleStatus,
} from "./placement-lifecycle-types";

export type {
  PlacementDepartureCategory,
  PlacementLifecycleStatus,
} from "./placement-lifecycle-types";

/**
 * Per D2: status-check milestones are at 3, 6, 12 months, then
 * annually. The cadence is hard-coded here so the list page, the
 * detail page, and the (Tier 2) cron all agree. Adjusting it means
 * editing this constant + plan D2 in lockstep.
 */
const MILESTONE_MONTHS = [3, 6, 12] as const;
const ANNUAL_AFTER_MONTHS = 12;

/**
 * Add `months` to a Date, preserving day-of-month where possible.
 * JS's native `setMonth` already handles month-end overflow (e.g.
 * Jan 31 + 1mo → Mar 3) which is good enough for the milestone
 * cadence  we never need calendar-perfect anniversaries here.
 */
function addMonths(d: Date, months: number): Date {
  const out = new Date(d.valueOf());
  out.setMonth(out.getMonth() + months);
  return out;
}

/**
 * Given a hire date + the last check timestamp (if any), compute:
 *
 *   nextDueAt  the next milestone date (may be in the past if a
 *               check is currently overdue). Always a Date.
 *
 *   isDue      true iff the most recent milestone date is in the
 *               past AND we haven't checked since it fired.
 *
 * The milestone series is `hiredAt + 3mo`, `+ 6mo`, `+ 12mo`, then
 * `+ N*12mo` for N ≥ 2. We don't need to enumerate the whole future
 * series  the calculation is O(1).
 */
function computeCheckCadence(
  hiredAt: Date,
  lastCheckAt: Date | null,
  now: Date,
): { nextDueAt: Date; isDue: boolean } {
  // Milestone dates as plain timestamps. Past-milestone = the latest
  // milestone <= now; future-milestone = the earliest milestone > now.
  const fixedMilestones = MILESTONE_MONTHS.map((m) => addMonths(hiredAt, m));
  // After the 12-month mark, milestones fire every `ANNUAL_AFTER_MONTHS`.
  // We need at most one past and one future annual milestone to answer
  // the question  enumerate up to whichever annual covers `now`.
  const monthsSinceHire =
    (now.getTime() - hiredAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsSinceHire >= 12) {
    const annualOffset =
      Math.floor((monthsSinceHire - 12) / ANNUAL_AFTER_MONTHS) + 2;
    fixedMilestones.push(addMonths(hiredAt, 12 * annualOffset));
    fixedMilestones.push(addMonths(hiredAt, 12 * (annualOffset + 1)));
  }

  const past = fixedMilestones.filter((d) => d.getTime() <= now.getTime());
  const future = fixedMilestones.filter((d) => d.getTime() > now.getTime());
  // Latest past milestone (the one currently "owed" a check) and the
  // earliest future milestone (the next one due).
  const currentMilestone =
    past.length > 0 ? past[past.length - 1]! : null;
  const nextMilestone = future[0] ?? addMonths(hiredAt, 12 * 99); // never null in practice

  if (currentMilestone === null) {
    // Pre-3-month  no check ever owed yet. The next milestone is the
    // 3-month mark.
    return { nextDueAt: nextMilestone, isDue: false };
  }
  const isDue =
    lastCheckAt === null || lastCheckAt.getTime() < currentMilestone.getTime();
  return {
    nextDueAt: isDue ? currentMilestone : nextMilestone,
    isDue,
  };
}

/**
 * Whole months elapsed between two dates, floored. We use 30.44 days /
 * month as an SI-friendly approximation  the list page rounds to
 * "N months" or "Y years M months" anyway, so the discrepancy is
 * never visible.
 */
function tenureMonths(hiredAt: Date, now: Date): number {
  return Math.max(
    0,
    Math.floor(
      (now.getTime() - hiredAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────
// Read shapes
// ─────────────────────────────────────────────────────────────────────

export interface EmployeeListRow {
  placementId: string;
  profileId: string;
  handle: string;
  displayName: string;
  /** Raw storage key  caller signs if needed. */
  profilePhotoUrl: string | null;
  role: string;
  city: string;
  /** ISO timestamp. */
  hiredAt: string;
  currentStatus: PlacementLifecycleStatus;
  /** ISO timestamp or null. */
  lastCheckAt: string | null;
  /** ISO date (YYYY-MM-DD) or null. Only populated when status='departed'. */
  departureDate: string | null;
  /** Phase 9.20 Tier 3  the structured category of the departure.
   *  NULL while status='active'. See `PlacementDepartureCategory`. */
  departureCategory: PlacementDepartureCategory | null;
  /** Months elapsed since hiredAt, floored. */
  tenureMonths: number;
  /** ISO date of the next check-in milestone (may be in the past). */
  nextCheckDueAt: string;
  /** True iff the most recent milestone has passed without a check. */
  checkInDue: boolean;
  /** Source vacancy linkage (Phase 9.8.6), if any. */
  vacancyId: string | null;
  vacancyTitle: string | null;
}

export interface EmployeeDetail extends EmployeeListRow {
  /** Org-private 1000-char note (Tier 1 read; Tier 2 makes it editable). */
  internalNote: string | null;
  /** Display name of the team-mate who last confirmed the status.
   *  NULL when lastCheckAt is NULL. */
  lastCheckByDisplayName: string | null;
  /** Display name of the original "Mark as hired" actor; useful on the
   *  detail page header. NULL for legacy seeded rows. */
  hiredByDisplayName: string | null;
}

export type EmployeeListTab = "active" | "departed" | "all";

export type EmployeeListSort =
  | "recent_hire"
  | "longest_tenure"
  | "check_due";

// ─────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────

/**
 * Lifecycle list view payload. Tab selects the lifecycle bucket;
 * sort re-orders client-side-friendly fields. Empty array when the
 * caller has no org context. Capped at 200 rows  the list view
 * is a recruiter's own org, not a public surface; orgs that grow
 * past 200 active placements will get the (Phase 10+) paged view.
 */
const LIST_CAP = 200;

export async function listEmployees({
  tab,
  sort,
}: {
  tab: EmployeeListTab;
  sort: EmployeeListSort;
}): Promise<EmployeeListRow[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();

  // Tab filter on current_status. 'all' = no extra clause.
  const tabClause =
    tab === "active"
      ? eq(schema.placements.currentStatus, "active")
      : tab === "departed"
        ? eq(schema.placements.currentStatus, "departed")
        : sql`TRUE`;

  // Sort key. "check_due" is computed in JS after the row pull
  // (cheap; capped at LIST_CAP); the SQL order-by here is the
  // tiebreaker so non-due rows still come back in a sensible order.
  const orderBy =
    sort === "longest_tenure"
      ? asc(schema.placements.hiredAt)
      : desc(schema.placements.hiredAt);

  const rows = await db
    .select({
      placementId: schema.placements.id,
      profileId: schema.placements.profileId,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      profilePhotoUrl: schema.profiles.profilePhotoUrl,
      role: schema.placements.role,
      city: schema.placements.city,
      hiredAt: schema.placements.hiredAt,
      currentStatus: schema.placements.currentStatus,
      lastCheckAt: schema.placements.lastCheckAt,
      departureDate: schema.placements.departureDate,
      departureCategory: schema.placements.departureCategory,
      vacancyId: schema.placements.vacancyId,
      vacancyTitle: schema.vacancies.title,
    })
    .from(schema.placements)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.placements.profileId),
    )
    .leftJoin(
      schema.vacancies,
      eq(schema.vacancies.id, schema.placements.vacancyId),
    )
    .where(
      and(eq(schema.placements.organizationId, session.orgId), tabClause),
    )
    .orderBy(orderBy)
    .limit(LIST_CAP);

  const now = new Date();
  const mapped: EmployeeListRow[] = rows.map((r) => {
    const hiredAt = r.hiredAt instanceof Date ? r.hiredAt : new Date(r.hiredAt);
    const lastCheckAt =
      r.lastCheckAt === null
        ? null
        : r.lastCheckAt instanceof Date
          ? r.lastCheckAt
          : new Date(r.lastCheckAt);
    const cadence = computeCheckCadence(hiredAt, lastCheckAt, now);
    return {
      placementId: r.placementId,
      profileId: r.profileId,
      handle: r.handle,
      displayName: r.displayName,
      profilePhotoUrl: r.profilePhotoUrl ?? null,
      role: r.role,
      city: r.city,
      hiredAt: hiredAt.toISOString(),
      currentStatus: r.currentStatus as PlacementLifecycleStatus,
      lastCheckAt: lastCheckAt ? lastCheckAt.toISOString() : null,
      departureDate: r.departureDate ?? null,
      departureCategory: (r.departureCategory ??
        null) as PlacementDepartureCategory | null,
      tenureMonths: tenureMonths(hiredAt, now),
      nextCheckDueAt: cadence.nextDueAt.toISOString(),
      // A departed placement has no future check owed  freeze the flag.
      checkInDue: r.currentStatus === "active" && cadence.isDue,
      vacancyId: r.vacancyId,
      vacancyTitle: r.vacancyTitle,
    };
  });

  if (sort === "check_due") {
    // Due rows first; within them, most overdue first; then the rest
    // in the SQL-determined order (already by hiredAt desc).
    mapped.sort((a, b) => {
      if (a.checkInDue !== b.checkInDue) return a.checkInDue ? -1 : 1;
      if (a.checkInDue) {
        return (
          new Date(a.nextCheckDueAt).valueOf() -
          new Date(b.nextCheckDueAt).valueOf()
        );
      }
      return 0; // stable for non-due rows
    });
  }
  return mapped;
}

/**
 * Load one placement scoped to the caller's org. Returns null when
 * the id doesn't match an org-owned row  same posture as
 * `getMyVacancy`: never differentiates "doesn't exist" from "exists
 * but not yours."
 */
export async function getEmployee(
  placementId: string,
): Promise<EmployeeDetail | null> {
  const session = await verifyEmployer();
  if (!session.orgId) return null;
  const db = getDb();

  // Aliased joins to app_user  we need TWO joins to it (last-check
  // actor + hire-time actor) and Drizzle requires aliases for the
  // self-join.
  const checkActor = schema.appUser;
  const rows = await db
    .select({
      placementId: schema.placements.id,
      profileId: schema.placements.profileId,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      profilePhotoUrl: schema.profiles.profilePhotoUrl,
      role: schema.placements.role,
      city: schema.placements.city,
      hiredAt: schema.placements.hiredAt,
      currentStatus: schema.placements.currentStatus,
      lastCheckAt: schema.placements.lastCheckAt,
      lastCheckByUserId: schema.placements.lastCheckByUserId,
      departureDate: schema.placements.departureDate,
      departureCategory: schema.placements.departureCategory,
      internalNote: schema.placements.internalNote,
      vacancyId: schema.placements.vacancyId,
      vacancyTitle: schema.vacancies.title,
      lastCheckByDisplayName: checkActor.name,
    })
    .from(schema.placements)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.placements.profileId),
    )
    .leftJoin(
      schema.vacancies,
      eq(schema.vacancies.id, schema.placements.vacancyId),
    )
    .leftJoin(
      checkActor,
      eq(checkActor.id, schema.placements.lastCheckByUserId),
    )
    .where(
      and(
        eq(schema.placements.id, placementId),
        eq(schema.placements.organizationId, session.orgId),
      ),
    )
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  // Resolve the original hire actor in a separate query (the placements
  // row carries it, but we need to look up the display name). Tiny
  // single-row lookup; not worth a three-way self-join.
  let hiredByDisplayName: string | null = null;
  const hireActorIdRow = await db
    .select({ id: schema.placements.actorUserId })
    .from(schema.placements)
    .where(eq(schema.placements.id, placementId))
    .limit(1);
  const hireActorId = hireActorIdRow[0]?.id;
  if (hireActorId) {
    const actorRows = await db
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, hireActorId))
      .limit(1);
    hiredByDisplayName = actorRows[0]?.name ?? null;
  }

  const now = new Date();
  const hiredAt = r.hiredAt instanceof Date ? r.hiredAt : new Date(r.hiredAt);
  const lastCheckAt =
    r.lastCheckAt === null
      ? null
      : r.lastCheckAt instanceof Date
        ? r.lastCheckAt
        : new Date(r.lastCheckAt);
  const cadence = computeCheckCadence(hiredAt, lastCheckAt, now);

  return {
    placementId: r.placementId,
    profileId: r.profileId,
    handle: r.handle,
    displayName: r.displayName,
    profilePhotoUrl: r.profilePhotoUrl ?? null,
    role: r.role,
    city: r.city,
    hiredAt: hiredAt.toISOString(),
    currentStatus: r.currentStatus as PlacementLifecycleStatus,
    lastCheckAt: lastCheckAt ? lastCheckAt.toISOString() : null,
    departureDate: r.departureDate ?? null,
    departureCategory: (r.departureCategory ??
      null) as PlacementDepartureCategory | null,
    tenureMonths: tenureMonths(hiredAt, now),
    nextCheckDueAt: cadence.nextDueAt.toISOString(),
    checkInDue: r.currentStatus === "active" && cadence.isDue,
    vacancyId: r.vacancyId,
    vacancyTitle: r.vacancyTitle,
    internalNote: r.internalNote ?? null,
    lastCheckByDisplayName: r.lastCheckByDisplayName ?? null,
    hiredByDisplayName,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Check-in history (Tier 1 reads it; Tier 2 writes it)
// ─────────────────────────────────────────────────────────────────────

export interface PlacementStatusCheckRow {
  id: string;
  /** ISO timestamp. */
  checkedAt: string;
  stillEmployed: boolean;
  note: string | null;
  /** Display name of the team-mate who clicked confirm. */
  checkedByDisplayName: string | null;
}

/**
 * Per-event check-in ledger for one placement, newest first. Returns
 * an empty list when the placement has no checks yet (the common
 * case at Tier 1 since the writes don't exist yet). Caller must have
 * already org-scoped the placement load.
 */
export async function listStatusChecksForPlacement(
  placementId: string,
): Promise<PlacementStatusCheckRow[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();

  // Verify org ownership via the parent placement before reading the
  // ledger. A leaked placementId from another org returns [].
  const owned = await db
    .select({ id: schema.placements.id })
    .from(schema.placements)
    .where(
      and(
        eq(schema.placements.id, placementId),
        eq(schema.placements.organizationId, session.orgId),
      ),
    )
    .limit(1);
  if (!owned[0]) return [];

  const rows = await db
    .select({
      id: schema.placementStatusChecks.id,
      checkedAt: schema.placementStatusChecks.checkedAt,
      stillEmployed: schema.placementStatusChecks.stillEmployed,
      note: schema.placementStatusChecks.note,
      checkedByDisplayName: schema.appUser.name,
    })
    .from(schema.placementStatusChecks)
    .leftJoin(
      schema.appUser,
      eq(schema.appUser.id, schema.placementStatusChecks.checkedByUserId),
    )
    .where(eq(schema.placementStatusChecks.placementId, placementId))
    .orderBy(desc(schema.placementStatusChecks.checkedAt));

  return rows.map((r) => ({
    id: r.id,
    checkedAt:
      r.checkedAt instanceof Date
        ? r.checkedAt.toISOString()
        : new Date(r.checkedAt).toISOString(),
    stillEmployed: r.stillEmployed,
    note: r.note ?? null,
    checkedByDisplayName: r.checkedByDisplayName ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Per-placement audit excerpt (last 10 placement.* rows)
// ─────────────────────────────────────────────────────────────────────

export interface PlacementAuditRow {
  id: string;
  kind: string;
  at: string;
  actor: string;
}

/**
 * The detail page renders a small "Activity" panel showing the last
 * N `placement.*` audit rows that touch this placement id. Read is
 * scoped to the caller's org (the placement's org_id is enforced via
 * `getEmployee` before this is called) so we can read by audit
 * subject + matching meta.placementId or subject = profileId. We use
 * the profileId lookup because the existing `placement.confirm`
 * audit kind writes `subject = profileId` and carries `placementId`
 * in meta  see `lib/employer/placements.ts:148-159`.
 */
const AUDIT_EXCERPT_CAP = 10;

export async function listPlacementAuditExcerpt(
  placementId: string,
  profileId: string,
): Promise<PlacementAuditRow[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();

  // Match on profileId (subject) AND placementId in meta. The org_id
  // in meta provides defence-in-depth even though `getEmployee` has
  // already scoped this caller to their own org.
  const rows = await db
    .select({
      id: schema.auditLog.id,
      kind: schema.auditLog.kind,
      at: schema.auditLog.at,
      actor: schema.auditLog.actor,
    })
    .from(schema.auditLog)
    .where(
      and(
        inArray(schema.auditLog.kind, [
          "placement.confirm",
          "placement.delete",
        ]),
        eq(schema.auditLog.subject, profileId),
        sql`${schema.auditLog.meta}->>'orgId' = ${session.orgId}`,
        sql`${schema.auditLog.meta}->>'placementId' = ${placementId}`,
      ),
    )
    .orderBy(desc(schema.auditLog.at))
    .limit(AUDIT_EXCERPT_CAP);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    at: r.at instanceof Date ? r.at.toISOString() : new Date(r.at).toISOString(),
    actor: r.actor,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Tier 2 writes  status check-ins + editable internal note
// ─────────────────────────────────────────────────────────────────────

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/**
 * Resolve session + edit-role + placement ownership in one go. Same
 * shape as the vacancy-shortlists guard (Phase 9.19 Tier 2). Viewer
 * is rejected  lifecycle edits are an editor-only affordance, same
 * gate the rest of the vacancy + placement surfaces use.
 */
async function requireEditableForPlacement(
  placementId: string,
): Promise<
  | {
      ok: true;
      orgId: string;
      userId: string;
      placement: { id: string; profileId: string; currentStatus: PlacementLifecycleStatus };
    }
  | { ok: false; message: string }
> {
  const session = await verifyEmployer();
  if (!session.orgId) {
    return { ok: false, message: "No organisation context." };
  }
  const db = getDb();
  const placementRows = await db
    .select({
      id: schema.placements.id,
      profileId: schema.placements.profileId,
      currentStatus: schema.placements.currentStatus,
    })
    .from(schema.placements)
    .where(
      and(
        eq(schema.placements.id, placementId),
        eq(schema.placements.organizationId, session.orgId),
      ),
    )
    .limit(1);
  const placement = placementRows[0];
  if (!placement) {
    return { ok: false, message: "Placement not found in your organisation." };
  }
  const memberRows = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, session.orgId),
        eq(schema.organizationMembers.userId, session.id),
      ),
    )
    .limit(1);
  const role = (memberRows[0]?.role ?? null) as OrgMemberRole | null;
  if (!canEditVacancies(role)) {
    return {
      ok: false,
      message:
        "Your role is read-only. Ask an Owner or Recruiter to edit this employee.",
    };
  }
  return {
    ok: true,
    orgId: session.orgId,
    userId: session.id,
    placement: {
      id: placement.id,
      profileId: placement.profileId,
      currentStatus: placement.currentStatus as PlacementLifecycleStatus,
    },
  };
}

const confirmStillEmployedSchema = z.object({
  placementId: z.string().min(1),
  /** Optional 500-char check-time note. Distinct from the durable
   *  org-private internalNote on the placement row  this is the
   *  context for THIS check ("confirmed via Slack DM, all good"). */
  note: z
    .string()
    .trim()
    .max(500, "Check-in note must be 500 characters or fewer.")
    .optional(),
});

/**
 * Phase 9.20 T2  confirm a placement is still active. Writes one
 * row to `placement_status_checks` and updates the denormalised
 * `last_check_at` / `last_check_by_user_id` on `placements` in a
 * single transaction so the list-view read can rely on them being
 * in step. Audit-logged as `placement.status.check` with the note
 * carried in meta (PII-flagged per D6).
 *
 * Rejected for placements whose current_status is 'departed'  the
 * UI hides the action in that case, but the action enforces it too.
 * 'unknown' is allowed (the check moves it back to 'active').
 */
export async function confirmPlacementStillEmployed(
  input: z.infer<typeof confirmStillEmployedSchema>,
): Promise<ActionResult> {
  const parsed = confirmStillEmployedSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid check-in input.");
  }
  const { placementId, note } = parsed.data;

  const guard = await requireEditableForPlacement(placementId);
  if (!guard.ok) return guard;

  if (guard.placement.currentStatus === "departed") {
    return fail(
      "This placement is already marked as departed  confirming is no longer available.",
    );
  }

  const noteForMeta = note && note.length > 0 ? note : null;
  const db = getDb();
  const checkId = `chk_${randomUUID()}`;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(schema.placementStatusChecks).values({
      id: checkId,
      placementId,
      checkedByUserId: guard.userId,
      checkedAt: now,
      stillEmployed: true,
      note: noteForMeta,
    });
    await tx
      .update(schema.placements)
      .set({
        currentStatus: "active",
        lastCheckAt: now,
        lastCheckByUserId: guard.userId,
      })
      .where(
        and(
          eq(schema.placements.id, placementId),
          eq(schema.placements.organizationId, guard.orgId),
        ),
      );
  });

  await logAccess({
    kind: "placement.status.check",
    actor: guard.userId,
    subject: guard.placement.profileId,
    meta: {
      orgId: guard.orgId,
      placementId,
      checkId,
      stillEmployed: true,
      ...(noteForMeta ? { note: noteForMeta, notePii: true } : {}),
    },
  });

  revalidatePath("/employer/placements");
  revalidatePath(`/employer/placements/${placementId}`);
  return ok();
}

const internalNoteSchema = z.object({
  placementId: z.string().min(1),
  note: z
    .string()
    .max(1000, "Internal note must be 1000 characters or fewer."),
});

/**
 * Phase 9.20 T2  set/update/clear the org-private internal note
 * (D6). Empty string clears the note (stored as NULL). Audit-logged
 * with the note in meta (PII-flagged); the audit-log row carries
 * both old and new lengths so the data-export sweep can find every
 * note historically attached to this placement.
 */
export async function updatePlacementInternalNote(
  input: z.infer<typeof internalNoteSchema>,
): Promise<ActionResult> {
  const parsed = internalNoteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid note input.");
  }
  const { placementId, note } = parsed.data;

  const guard = await requireEditableForPlacement(placementId);
  if (!guard.ok) return guard;

  const trimmed = note.trim();
  const persisted = trimmed.length === 0 ? null : trimmed;
  const db = getDb();

  await db
    .update(schema.placements)
    .set({ internalNote: persisted })
    .where(
      and(
        eq(schema.placements.id, placementId),
        eq(schema.placements.organizationId, guard.orgId),
      ),
    );

  await logAccess({
    kind: "placement.note.update",
    actor: guard.userId,
    subject: guard.placement.profileId,
    meta: {
      orgId: guard.orgId,
      placementId,
      noteLength: trimmed.length,
      ...(persisted ? { note: persisted, notePii: true } : { noteCleared: true }),
    },
  });

  revalidatePath("/employer/placements");
  revalidatePath(`/employer/placements/${placementId}`);
  return ok();
}

// ─────────────────────────────────────────────────────────────────────
// Tier 3 writes  departure capture
// ─────────────────────────────────────────────────────────────────────

const departureSchema = z.object({
  placementId: z.string().min(1),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  category: z.enum([
    "resigned",
    "contract_ended",
    "dismissed",
    "retrenched",
    "moved_internally",
    "mutual_separation",
    "other",
  ]),
  /** Optional 500-char context appended to the durable internal note.
   *  Per D4 we never capture the *reason* as a structured field; this
   *  is the employer's own free-text memory aid. */
  note: z
    .string()
    .trim()
    .max(500, "Departure note must be 500 characters or fewer.")
    .optional(),
});

export type DepartureInput = z.infer<typeof departureSchema>;

/**
 * Phase 9.20 Tier 3 D4  flip a placement to `departed`. Idempotent
 * for a placement that's already departed (returns the existing
 * state); rejects any input where the date is in the future or
 * before the hire date (the floor + ceiling sanity check).
 *
 * Appends the optional note to the durable internalNote with a
 * `Departure (YYYY-MM-DD, <category>):` prefix so context never
 * silently overwrites prior notes. Audit log carries category +
 * date; internal_note text is PII-flagged.
 */
export async function markPlacementDeparted(
  input: DepartureInput,
): Promise<ActionResult> {
  const parsed = departureSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid departure input.");
  }
  const { placementId, departureDate, category, note } = parsed.data;

  const guard = await requireEditableForPlacement(placementId);
  if (!guard.ok) return guard;

  if (guard.placement.currentStatus === "departed") {
    return fail(
      "This placement is already marked as departed. Open the detail page to see when and why.",
    );
  }

  // Sanity-check the date against the placement's hire date.
  const db = getDb();
  const hireRows = await db
    .select({
      hiredAt: schema.placements.hiredAt,
      internalNote: schema.placements.internalNote,
    })
    .from(schema.placements)
    .where(eq(schema.placements.id, placementId))
    .limit(1);
  const hireRow = hireRows[0];
  if (!hireRow) return fail("Placement not found.");
  const departureMs = new Date(departureDate).valueOf();
  if (Number.isNaN(departureMs)) {
    return fail("Departure date is not a valid date.");
  }
  if (departureMs < hireRow.hiredAt.valueOf()) {
    return fail("Departure date cannot be before the hire date.");
  }
  if (departureMs > Date.now() + 24 * 60 * 60 * 1000) {
    return fail("Departure date cannot be in the future.");
  }

  // Compose the durable note. Existing note (if any) is preserved; the
  // new context is appended with a dated header so the trail is honest.
  let nextInternalNote: string | null = hireRow.internalNote ?? null;
  const trimmedNote = note?.trim() ?? "";
  if (trimmedNote.length > 0) {
    const header = `Departure (${departureDate}, ${category}):`;
    const block = `${header} ${trimmedNote}`;
    nextInternalNote = nextInternalNote
      ? `${nextInternalNote}\n\n${block}`
      : block;
    // Cap the durable note at the same 1000-char ceiling
    // updatePlacementInternalNote enforces. If we'd blow past it, fail
    // explicitly rather than silently truncating.
    if (nextInternalNote.length > 1000) {
      return fail(
        "Adding this departure note would push the internal note past the 1000-char cap. Trim the note (or edit the existing internal note) and try again.",
      );
    }
  }

  await db
    .update(schema.placements)
    .set({
      currentStatus: "departed",
      departureDate,
      departureCategory: category,
      internalNote: nextInternalNote,
    })
    .where(
      and(
        eq(schema.placements.id, placementId),
        eq(schema.placements.organizationId, guard.orgId),
      ),
    );

  await logAccess({
    kind: "placement.departed",
    actor: guard.userId,
    subject: guard.placement.profileId,
    meta: {
      orgId: guard.orgId,
      placementId,
      departureDate,
      category,
      ...(trimmedNote.length > 0
        ? { note: trimmedNote, notePii: true }
        : {}),
    },
  });

  revalidatePath("/employer/placements");
  revalidatePath(`/employer/placements/${placementId}`);
  return ok();
}

// ─────────────────────────────────────────────────────────────────────
// Tier 3 read  re-engage panel (D7)
// ─────────────────────────────────────────────────────────────────────

export interface OpenVacancyOption {
  vacancyId: string;
  title: string;
}

/**
 * Phase 9.20 Tier 3 D7  list this org's currently-open vacancies for
 * the post-departure re-engage panel. Returns title + id only; the
 * subsequent invite goes through the existing `bulkInviteToVacancy`
 * path (the panel calls it with `profileIds = [departed.profileId]`),
 * so no new consent gate, no new audit kind, no new write here.
 */
export async function listOpenVacanciesForReengage(): Promise<
  OpenVacancyOption[]
> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();
  const rows = await db
    .select({
      vacancyId: schema.vacancies.id,
      title: schema.vacancies.title,
    })
    .from(schema.vacancies)
    .where(
      and(
        eq(schema.vacancies.organizationId, session.orgId),
        eq(schema.vacancies.status, "open"),
      ),
    )
    .orderBy(desc(schema.vacancies.createdAt))
    .limit(20);
  return rows.map((r) => ({ vacancyId: r.vacancyId, title: r.title }));
}
