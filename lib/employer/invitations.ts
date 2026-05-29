"use server";

/**
 * Phase 9.8.4  Vacancy invitations (bulk-invite + withdraw + reads).
 *
 * Same privacy invariant as `lib/employer/vacancies.ts`: every read is
 * scoped by `organizationId` (resolved via the parent vacancy) and
 * every write Server Action calls `verifyEmployer()` then re-checks
 * vacancy ownership via `getMyVacancy()` before mutating. The
 * compliance assertion (a) in 9.8.8 catches regressions.
 *
 * Consent gate (D5 + 9.8.8 check (b)): a row is only ever written
 * when the seeker had `vacancy_matching` consent in `state='granted'`
 * at write time. `bulkInviteToVacancy` splits selections into
 * eligible + skipped via `hasVacancyMatchingConsent()`; the
 * per-seeker skip reason lives in the audit log only and is NEVER
 * exposed in the response payload (it would leak consent state to the
 * employer). The action returns the soft summary numbers only.
 *
 * Role gating: Owner + Recruiter can invite + withdraw. Viewer is
 * read-only. Enforced via the existing `canEditVacancies()` helper.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { logAccess } from "@/lib/audit";
import { hasVacancyMatchingConsent } from "@/lib/consent/check";
import { createNotification, notifyOrgMembers } from "@/lib/notifications/server";

import { getMyVacancy, getMyOrgRole } from "./vacancies";
import { canEditVacancies } from "./vacancies-types";
import { verifyEmployer } from "@/lib/auth/dal";

// ─────────────────────────────────────────────────────────────────────────────
// Result shapes (kept narrow + serialisable for the client island)
// ─────────────────────────────────────────────────────────────────────────────

export type InvitationState =
  | "invited"
  | "accepted"
  | "accepted_with_notice"
  | "declined"
  | "reconsidering"
  | "withdrawn"
  | "expired";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const SEASONAL_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Phase 9.21 D6  render a vacancy's season window as a one-line
 * suffix for the invitation notification body. Returns "" when the
 * window is unset so the body concatenation stays clean. Handles
 * D4's year-wrap (start > end is e.g. NovFeb) and the single-month
 * case (start === end is "December only").
 *
 * Lives in this file (not on the vacancy reader) because the
 * notification copy is its own concern  the vacancy detail page has
 * its own renderer with slightly different framing.
 */
function formatSeasonalWindowLine(
  window: import("@/lib/mock/types").SeasonalWindow | null,
): string {
  if (!window) return "";
  const start = SEASONAL_MONTH_LABELS[window.startMonth - 1] ?? "?";
  const end = SEASONAL_MONTH_LABELS[window.endMonth - 1] ?? "?";
  const range =
    window.startMonth === window.endMonth ? start : `${start}${end}`;
  const tail = window.recurringAnnually
    ? "annually"
    : "this year only, no recurrence";
  return `\n\nSeasonal window: ${range}, ${tail}.`;
}

/** Skip reason recorded in the audit log per D5. NEVER exposed to the
 *  employer UI  the action's response carries only counts. */
export type SkipReason =
  | "consent_not_granted"
  | "already_invited"
  | "profile_deleted"
  | "profile_not_found";

/** Detail row for the employer's per-vacancy invitations panel. The
 *  `displayName` + `handle` come from the profile join; nothing here is
 *  PII the employer wouldn't already see in /search or the dossier. */
export interface InvitationRow {
  id: string;
  profileId: string;
  handle: string;
  displayName: string;
  state: InvitationState;
  invitedAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
  noticePeriodMonths: number | null;
  declineReason: string | null;
  declineNote: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set of profile IDs already invited on this vacancy (any state).
 * The bulk-invite action uses this to short-circuit re-invites; the
 * match page uses it to flag already-invited rows so the employer
 * doesn't waste a slot on someone already in the pipeline.
 */
export async function getInvitedProfileIdsForVacancy(
  vacancyId: string,
): Promise<Set<string>> {
  const vacancy = await getMyVacancy(vacancyId);
  if (!vacancy) return new Set();
  const db = getDb();
  const rows = await db
    .select({ profileId: schema.vacancyInvitations.profileId })
    .from(schema.vacancyInvitations)
    .where(eq(schema.vacancyInvitations.vacancyId, vacancyId));
  return new Set(rows.map((r) => r.profileId));
}

/**
 * List every invitation on this vacancy, newest first. Joins to
 * `profiles` for the display fields the employer needs in the
 * pipeline panel. Org-scoped via `getMyVacancy` so a foreign org
 * cannot probe.
 */
export async function listInvitationsForVacancy(
  vacancyId: string,
): Promise<InvitationRow[]> {
  const vacancy = await getMyVacancy(vacancyId);
  if (!vacancy) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: schema.vacancyInvitations.id,
      profileId: schema.vacancyInvitations.profileId,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      state: schema.vacancyInvitations.state,
      invitedAt: schema.vacancyInvitations.invitedAt,
      expiresAt: schema.vacancyInvitations.expiresAt,
      respondedAt: schema.vacancyInvitations.respondedAt,
      noticePeriodMonths: schema.vacancyInvitations.noticePeriodMonths,
      declineReason: schema.vacancyInvitations.declineReason,
      declineNote: schema.vacancyInvitations.declineNote,
    })
    .from(schema.vacancyInvitations)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.vacancyInvitations.profileId),
    )
    .where(eq(schema.vacancyInvitations.vacancyId, vacancyId))
    .orderBy(desc(schema.vacancyInvitations.invitedAt));

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profileId,
    handle: r.handle,
    displayName: r.displayName,
    state: r.state as InvitationState,
    invitedAt: toIso(r.invitedAt),
    expiresAt: r.expiresAt ? toIso(r.expiresAt) : null,
    respondedAt: r.respondedAt ? toIso(r.respondedAt) : null,
    noticePeriodMonths: r.noticePeriodMonths,
    declineReason: r.declineReason,
    declineNote: r.declineNote,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes  Server Actions
// ─────────────────────────────────────────────────────────────────────────────

const bulkInviteSchema = z.object({
  vacancyId: z.string().min(1),
  // Cap at 50 per call to match the SEARCH_LIMIT on the match view.
  profileIds: z.array(z.string().min(1)).min(1).max(50),
  /**
   * Phase 9.19 Tier 3  optional employer-authored note attached to
   * every invite in this batch. Same 200-char cap as the Phase 9.17
   * seeker-invite note, same PII-flagged audit treatment (D6). NULL
   * / empty = no note. We deliberately do NOT persist the note on
   * the invitation row  it's a moment-of-invitation gesture, not a
   * durable field. Lives in the audit `meta.note` only, where the
   * Phase 9.17 PII flag already handles export sweeps.
   */
  personalNote: z
    .string()
    .trim()
    .max(200, "Note must be 200 characters or fewer.")
    .optional(),
});

/**
 * Bulk-invite a set of profiles to a vacancy.
 *
 * Splits the selection into:
 *   - **eligible**: consent granted + not already invited  writes an
 *     invitation row, fires `vacancy.invite` notification, audits as
 *     `vacancy.invite`.
 *   - **skipped**: anything that fails one of the gates. Each skip
 *     writes one `vacancy.invite.skip` audit row with the actual
 *     reason. The returned payload carries **counts only**  the
 *     per-seeker reason is never exposed (D5).
 *
 * The whole thing runs sequentially per seeker (no transaction across
 * the whole batch) because each consent-check + insert is independent;
 * a single bad seeker should not torpedo the batch.
 */
export async function bulkInviteToVacancy(
  input: z.infer<typeof bulkInviteSchema>,
): Promise<
  ActionResult<{
    invited: number;
    skipped: number;
  }>
> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;

  const parsed = bulkInviteSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid invite request.");
  const { vacancyId, profileIds, personalNote } = parsed.data;
  const noteForMeta = personalNote && personalNote.length > 0 ? personalNote : null;

  // Re-fetch the vacancy with org scoping (the privacy invariant).
  const vacancy = await getMyVacancy(vacancyId);
  if (!vacancy) return fail("Vacancy not found in your organisation.");
  if (vacancy.status !== "open" && vacancy.status !== "draft") {
    // Closed / filled vacancies should not be inviting people.
    return fail("This vacancy is not open for invites.");
  }

  const db = getDb();

  // Pull the user_id + handle for each profile in one round trip.
  const profileRows = await db
    .select({
      id: schema.profiles.id,
      userId: schema.profiles.userId,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      deletedAt: schema.profiles.deletedAt,
    })
    .from(schema.profiles)
    .where(inArray(schema.profiles.id, profileIds));

  // Pre-compute the org's display name + the vacancy attribution
  // string  every notification body needs them. Fall back to org id
  // if the org record is somehow gone (shouldn't happen post-Phase 2).
  const orgRow = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, guard.orgId))
    .limit(1);
  const orgName = orgRow[0]?.name ?? "An employer";

  // Pull existing invitations on this vacancy for the `already_invited`
  // dedupe (cheaper than per-seeker existence checks inside the loop).
  const existingInvited = await getInvitedProfileIdsForVacancy(vacancyId);

  const expiresAt =
    vacancy.inviteExpiryDays != null && vacancy.inviteExpiryDays > 0
      ? new Date(
          Date.now() + vacancy.inviteExpiryDays * 24 * 60 * 60 * 1000,
        )
      : null;

  let invitedCount = 0;
  let skippedCount = 0;

  for (const pid of profileIds) {
    const profile = profileRows.find((p) => p.id === pid);

    if (!profile) {
      await logSkip(guard.userId, vacancyId, pid, "profile_not_found");
      skippedCount++;
      continue;
    }
    if (profile.deletedAt) {
      await logSkip(guard.userId, vacancyId, pid, "profile_deleted");
      skippedCount++;
      continue;
    }
    if (existingInvited.has(pid)) {
      await logSkip(guard.userId, vacancyId, pid, "already_invited");
      skippedCount++;
      continue;
    }

    const hasConsent = await hasVacancyMatchingConsent(profile.userId);
    if (!hasConsent) {
      await logSkip(guard.userId, vacancyId, pid, "consent_not_granted");
      skippedCount++;
      continue;
    }

    // Eligible  write the invitation row + fire notification + audit.
    const invitationId = `inv_${randomUUID()}`;
    try {
      await db.insert(schema.vacancyInvitations).values({
        id: invitationId,
        vacancyId,
        profileId: pid,
        invitedByUserId: guard.userId,
        expiresAt,
        state: "invited",
      });

      // Attributed notification per the plan: name the employer + the
      // role. No anonymous invites. Phase 9.19 D6  the personal note,
      // when present, is appended to the notification body (so the
      // seeker actually reads it) AND captured in the audit meta as a
      // PII-flagged field for the export sweep.
      const noteSuffix = noteForMeta
        ? `\n\nNote from ${orgName}: ${noteForMeta}`
        : "";
      // Phase 9.21 D6  season window line riding on the same body.
      // Informational only (D5)  the seeker reads it to decide; we
      // don't filter on it at the match layer.
      const seasonalLine = formatSeasonalWindowLine(vacancy.seasonalWindow);
      await createNotification({
        userId: profile.userId,
        kind: "vacancy.invite",
        title: `${orgName} flagged you for: ${vacancy.title}`,
        body:
          `Open the invite to accept, decline, or decline with a reason. ` +
          (expiresAt
            ? `Responds-by: ${expiresAt.toISOString().slice(0, 10)}.`
            : `No expiry on this invite.`) +
          seasonalLine +
          noteSuffix,
        link: `/dashboard/invitations/${invitationId}`,
        meta: {
          invitationId,
          vacancyId,
          orgId: guard.orgId,
          orgName,
        },
      });

      await logAccess({
        kind: "vacancy.invite",
        actor: guard.userId,
        subject: invitationId,
        meta: {
          orgId: guard.orgId,
          vacancyId,
          profileId: pid,
          handle: profile.handle,
          // Phase 9.19 D6  reuse the existing PII flag pattern from
          // Phase 9.17 (seeker-invite notes). Stored in audit only; not
          // mirrored on the invitation row.
          ...(noteForMeta ? { note: noteForMeta, notePii: true } : {}),
        },
      });

      invitedCount++;
    } catch (e) {
      // Unique-index violation = a race against another concurrent
      // bulk-invite; treat as already_invited (the audit-log row
      // captures the actual cause).
      // eslint-disable-next-line no-console
      console.error(`[bulkInviteToVacancy] insert failed for ${pid}:`, e);
      await logSkip(guard.userId, vacancyId, pid, "already_invited");
      skippedCount++;
    }
  }

  revalidatePath(`/employer/vacancies/${vacancyId}`);
  revalidatePath(`/employer/vacancies/${vacancyId}/match`);
  return ok({ invited: invitedCount, skipped: skippedCount });
}

const withdrawSchema = z.object({
  invitationId: z.string().min(1),
});

/**
 * Employer withdraws an active invitation. Only `state='invited'` can
 * be withdrawn  if the seeker has already responded, withdrawal is
 * not the right tool (cancel the vacancy or let the lifecycle play
 * out).
 */
export async function withdrawInvitation(
  input: z.infer<typeof withdrawSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;

  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid invitation id.");
  const { invitationId } = parsed.data;

  const db = getDb();

  // Re-fetch + org-scope check via the parent vacancy.
  const rows = await db
    .select({
      id: schema.vacancyInvitations.id,
      vacancyId: schema.vacancyInvitations.vacancyId,
      profileId: schema.vacancyInvitations.profileId,
      state: schema.vacancyInvitations.state,
      organizationId: schema.vacancies.organizationId,
      orgName: schema.organizations.name,
      vacancyTitle: schema.vacancies.title,
      profileUserId: schema.profiles.userId,
      handle: schema.profiles.handle,
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
    .where(eq(schema.vacancyInvitations.id, invitationId))
    .limit(1);

  const row = rows[0];
  if (!row) return fail("Invitation not found.");
  if (row.organizationId !== guard.orgId) {
    // Don't disclose existence  same shape as `getMyVacancy`.
    return fail("Invitation not found.");
  }
  if (row.state !== "invited") {
    return fail(
      "This invite has already moved past the 'invited' state and can't be withdrawn.",
    );
  }

  await db
    .update(schema.vacancyInvitations)
    .set({ state: "withdrawn", respondedAt: new Date() })
    .where(eq(schema.vacancyInvitations.id, invitationId));

  await createNotification({
    userId: row.profileUserId,
    kind: "vacancy.invite.expired", // re-use the polite "no longer open" kind
    title: `${row.orgName} withdrew an invitation`,
    body: `The invite for "${row.vacancyTitle}" is no longer open. No action required.`,
    meta: {
      invitationId,
      vacancyId: row.vacancyId,
      reason: "withdrawn_by_employer",
    },
  });

  await logAccess({
    kind: "vacancy.invite.withdraw",
    actor: guard.userId,
    subject: invitationId,
    meta: {
      orgId: guard.orgId,
      vacancyId: row.vacancyId,
      profileId: row.profileId,
      handle: row.handle,
    },
  });

  revalidatePath(`/employer/vacancies/${row.vacancyId}`);
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function requireEditRole(): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; message: string }
> {
  const session = await verifyEmployer();
  if (!session.orgId) {
    return { ok: false, message: "No organisation context." };
  }
  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    return {
      ok: false,
      message:
        "Your role is read-only for vacancies. Ask an Owner or Recruiter to invite candidates.",
    };
  }
  return { ok: true, orgId: session.orgId, userId: session.id };
}

async function logSkip(
  actor: string,
  vacancyId: string,
  profileId: string,
  reason: SkipReason,
): Promise<void> {
  await logAccess({
    kind: "vacancy.invite.skip",
    actor,
    subject: profileId,
    meta: { vacancyId, reason },
  });
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

// Cron-only helpers live in `./invitations-cron.ts`  a non-"use server"
// sibling so they can't accidentally become Server Actions invokable by
// a client component import. See PHASE_9_8_PLAN.md task 9.8.4 for the
// /api/cron/vacancy-invite-expiry contract.
