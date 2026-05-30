"use server";

/**
 * Phase 9.8.5  Seeker response actions on vacancy invitations.
 *
 * Four entry points (all responses to the same row):
 *   - acceptInvitation              → state = accepted
 *   - acceptInvitationWithNotice    → state = accepted_with_notice (D1)
 *   - declineInvitation             → state = declined  (+ reason + note)
 *   - reconsiderInvitation          → state = reconsidering (D-change-of-mind)
 *
 * Privacy invariant: every action loads the invitation, joins to
 * `profiles` to get the row's `user_id`, and asserts `userId ===
 * session.id` before mutating. A foreign seeker cannot respond to
 * someone else's invitation  the action returns the same generic
 * "Invitation not found" message a true miss would return, so an
 * attacker can't enumerate invitation ids.
 *
 * Audit: every successful response writes one `vacancy.response`
 * audit row with `meta.responseKind` differentiating
 * accept/accept_with_notice/decline/reconsider. Decline-note is
 * flagged in meta as `seekerAuthoredFreeText: true` per D3 so any
 * CSV export from `lib/analytics/csv.ts` flags it as PII downstream.
 *
 * Notifications: accept/decline fire `vacancy.response` to org
 * members; reconsider fires `vacancy.reconsider`. Both are attributed
 * (employer sees the seeker's display name + the vacancy title)
 * never anonymous.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { notifyOrgMembers } from "@/lib/notifications/server";

// Types + label catalog live in a plain sibling module so client islands
// (which need the labels) can import them without dragging a "use server"
// boundary. The Server Actions below use them via type-only or function-
// scoped imports.
import {
  DECLINE_REASON_LABEL,
  type DeclineReasonValue,
  type InvitationStateSeeker,
  type SeekerInvitationRow,
} from "./invitations-types";

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every invitation for the signed-in seeker, newest first. Joins to
 * `vacancies` + `organizations` so the dashboard can render the
 * attributed cards without extra round trips.
 *
 * NB: returns ALL states including expired / withdrawn  the seeker
 * benefits from knowing the full picture (so they can see "the role
 * was filled before you replied" as a polite closure, not silence).
 * The list page sorts terminal states to the bottom in the UI.
 */
export async function listMyInvitations(): Promise<SeekerInvitationRow[]> {
  const session = await verifyRole("seeker");
  const db = getDb();

  // Resolve the seeker's profile id from the session user id.
  const profileRow = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profileId = profileRow[0]?.id;
  if (!profileId) return [];

  const rows = await db
    .select({
      id: schema.vacancyInvitations.id,
      state: schema.vacancyInvitations.state,
      invitedAt: schema.vacancyInvitations.invitedAt,
      expiresAt: schema.vacancyInvitations.expiresAt,
      respondedAt: schema.vacancyInvitations.respondedAt,
      noticePeriodMonths: schema.vacancyInvitations.noticePeriodMonths,
      declineReason: schema.vacancyInvitations.declineReason,
      declineNote: schema.vacancyInvitations.declineNote,
      vacancyId: schema.vacancies.id,
      vacancyTitle: schema.vacancies.title,
      professionSlug: schema.vacancies.professionSlug,
      provinceSlug: schema.vacancies.provinceSlug,
      citySlug: schema.vacancies.citySlug,
      seniority: schema.vacancies.seniority,
      description: schema.vacancies.description,
      orgId: schema.organizations.id,
      orgName: schema.organizations.name,
      // Phase 9.21  season window for the detail page.
      seasonalWindowStartMonth: schema.vacancies.seasonalWindowStartMonth,
      seasonalWindowEndMonth: schema.vacancies.seasonalWindowEndMonth,
      seasonalWindowStartYear: schema.vacancies.seasonalWindowStartYear,
      seasonalWindowEndYear: schema.vacancies.seasonalWindowEndYear,
      seasonalWindowRecurringAnnually:
        schema.vacancies.seasonalWindowRecurringAnnually,
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
    .where(eq(schema.vacancyInvitations.profileId, profileId))
    .orderBy(desc(schema.vacancyInvitations.invitedAt));

  return rows.map(toSeekerRow);
}

/**
 * Single invitation for the per-invitation detail page. Returns `null`
 * for any miss (genuine not-found or invitation belonging to another
 * seeker)  same idiom as `getMyVacancy()` on the employer side, so
 * an attacker can't probe for foreign-row existence.
 */
export async function getMyInvitation(
  invitationId: string,
): Promise<SeekerInvitationRow | null> {
  const session = await verifyRole("seeker");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.vacancyInvitations.id,
      state: schema.vacancyInvitations.state,
      invitedAt: schema.vacancyInvitations.invitedAt,
      expiresAt: schema.vacancyInvitations.expiresAt,
      respondedAt: schema.vacancyInvitations.respondedAt,
      noticePeriodMonths: schema.vacancyInvitations.noticePeriodMonths,
      declineReason: schema.vacancyInvitations.declineReason,
      declineNote: schema.vacancyInvitations.declineNote,
      vacancyId: schema.vacancies.id,
      vacancyTitle: schema.vacancies.title,
      professionSlug: schema.vacancies.professionSlug,
      provinceSlug: schema.vacancies.provinceSlug,
      citySlug: schema.vacancies.citySlug,
      seniority: schema.vacancies.seniority,
      description: schema.vacancies.description,
      orgId: schema.organizations.id,
      orgName: schema.organizations.name,
      ownerUserId: schema.profiles.userId,
      // Phase 9.21  season window for the detail page.
      seasonalWindowStartMonth: schema.vacancies.seasonalWindowStartMonth,
      seasonalWindowEndMonth: schema.vacancies.seasonalWindowEndMonth,
      seasonalWindowStartYear: schema.vacancies.seasonalWindowStartYear,
      seasonalWindowEndYear: schema.vacancies.seasonalWindowEndYear,
      seasonalWindowRecurringAnnually:
        schema.vacancies.seasonalWindowRecurringAnnually,
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

  const r = rows[0];
  if (!r) return null;
  if (r.ownerUserId !== session.id) return null;
  return toSeekerRow(r);
}

function toSeekerRow(r: {
  id: string;
  state: string;
  invitedAt: Date | string;
  expiresAt: Date | string | null;
  respondedAt: Date | string | null;
  noticePeriodMonths: number | null;
  declineReason: string | null;
  declineNote: string | null;
  vacancyId: string;
  vacancyTitle: string;
  professionSlug: string;
  provinceSlug: string;
  citySlug: string | null;
  seniority: string | null;
  description: string | null;
  orgId: string;
  orgName: string;
  seasonalWindowStartMonth: number | null;
  seasonalWindowEndMonth: number | null;
  seasonalWindowStartYear: number | null;
  seasonalWindowEndYear: number | null;
  seasonalWindowRecurringAnnually: boolean | null;
}): SeekerInvitationRow {
  return {
    id: r.id,
    state: r.state as InvitationStateSeeker,
    invitedAt: toIso(r.invitedAt),
    expiresAt: r.expiresAt ? toIso(r.expiresAt) : null,
    respondedAt: r.respondedAt ? toIso(r.respondedAt) : null,
    noticePeriodMonths: r.noticePeriodMonths,
    declineReason: r.declineReason as DeclineReasonValue | null,
    declineNote: r.declineNote,
    vacancyId: r.vacancyId,
    vacancyTitle: r.vacancyTitle,
    professionSlug: r.professionSlug,
    provinceSlug: r.provinceSlug,
    citySlug: r.citySlug,
    seniority: r.seniority,
    description: r.description,
    orgId: r.orgId,
    orgName: r.orgName,
    // Phase 9.21  fold partial windows to NULL (same read-side
    // guard as VacancyRow's rowToVacancy mapper).
    seasonalWindow:
      r.seasonalWindowStartMonth != null && r.seasonalWindowEndMonth != null
        ? {
            startMonth: r.seasonalWindowStartMonth,
            endMonth: r.seasonalWindowEndMonth,
            startYear: r.seasonalWindowStartYear ?? null,
            endYear: r.seasonalWindowEndYear ?? null,
            recurringAnnually: r.seasonalWindowRecurringAnnually ?? true,
          }
        : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes  Server Actions
// ─────────────────────────────────────────────────────────────────────────────

const idSchema = z.object({ invitationId: z.string().min(1) });

const acceptNoticeSchema = idSchema.extend({
  noticePeriodMonths: z.coerce.number().int().min(1).max(12),
});

const declineSchema = idSchema.extend({
  reason: z.enum([
    "already_employed",
    "salary_not_competitive",
    "location_not_feasible",
    "skills_mismatch",
    "role_not_what_im_looking_for",
    "other",
  ]),
  // D3  200-char cap enforced here AND at the DB column type (text)
  // is unconstrained; the cap is purely an application contract. The
  // schema check on `other` ensures the note is non-empty when the
  // reason itself doesn't say anything specific.
  note: z.string().trim().max(200).optional(),
});

/** Accept now. Available now  the employer can move to interview. */
export async function acceptInvitation(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return respond({
    input,
    inputSchema: idSchema,
    targetState: "accepted",
    auditResponseKind: "accept",
    notificationKind: "vacancy.response",
    titleForOrg: (seekerName, vacancyTitle) =>
      `${seekerName} accepted your invitation to "${vacancyTitle}"`,
    bodyForOrg: () =>
      "Move them through the dossier / contact flow for next steps.",
    update: () => ({ state: "accepted" as const, respondedAt: new Date() }),
  });
}

/** Accept with notice period. Counts as a yes everywhere; the notice
 *  months tell the employer when the seeker is realistically available. */
export async function acceptInvitationWithNotice(
  input: z.infer<typeof acceptNoticeSchema>,
): Promise<ActionResult> {
  return respond({
    input,
    inputSchema: acceptNoticeSchema,
    targetState: "accepted_with_notice",
    auditResponseKind: "accept_with_notice",
    notificationKind: "vacancy.response",
    titleForOrg: (seekerName, vacancyTitle) =>
      `${seekerName} accepted your invitation to "${vacancyTitle}" (with notice)`,
    bodyForOrg: (_, parsed) => {
      const months = (parsed as z.infer<typeof acceptNoticeSchema>)
        .noticePeriodMonths;
      return `Notice period: ${months} month${months === 1 ? "" : "s"}. Plan interviews accordingly.`;
    },
    update: (parsed) => ({
      state: "accepted_with_notice" as const,
      respondedAt: new Date(),
      noticePeriodMonths: (parsed as z.infer<typeof acceptNoticeSchema>)
        .noticePeriodMonths,
    }),
  });
}

/** Decline with a structured reason + optional 200-char note. */
export async function declineInvitation(
  input: z.infer<typeof declineSchema>,
): Promise<ActionResult> {
  // Custom validation: `other` requires a note. Enforced here instead
  // of in the zod schema so the error message is friendlier.
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Invalid decline input.",
    );
  }
  if (parsed.data.reason === "other" && !parsed.data.note?.trim()) {
    return fail("A short note is required when choosing “Other.”");
  }

  return respond({
    input: parsed.data,
    inputSchema: declineSchema,
    targetState: "declined",
    auditResponseKind: "decline",
    notificationKind: "vacancy.response",
    titleForOrg: (seekerName, vacancyTitle) =>
      `${seekerName} declined your invitation to "${vacancyTitle}"`,
    bodyForOrg: (_, parsedIn) => {
      const reason = (parsedIn as z.infer<typeof declineSchema>).reason;
      return `Reason: ${DECLINE_REASON_LABEL[reason]}.`;
    },
    update: (parsedIn) => {
      const v = parsedIn as z.infer<typeof declineSchema>;
      return {
        state: "declined" as const,
        respondedAt: new Date(),
        declineReason: v.reason,
        // Store the note only when non-empty; an empty string would
        // look like the seeker explicitly chose to write nothing.
        declineNote: v.note?.trim() ? v.note.trim() : null,
      };
    },
    extraAuditMeta: (parsedIn) => {
      const v = parsedIn as z.infer<typeof declineSchema>;
      return {
        declineReason: v.reason,
        // D3  flag seeker free text as PII so downstream CSV exports
        // see it labelled correctly (compliance assertion (f) in 9.8.8).
        ...(v.note?.trim()
          ? {
              declineNote: v.note.trim(),
              seekerAuthoredFreeText: true,
            }
          : {}),
      };
    },
  });
}

/** Change-of-mind: a previously-declined seeker re-opens the door.
 *  Only valid from `declined`  reconsider isn't an undo for accept or
 *  for expired/withdrawn rows. Fires `vacancy.reconsider` instead of
 *  `vacancy.response` so the employer's bell shows a distinct event. */
export async function reconsiderInvitation(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return respond({
    input,
    inputSchema: idSchema,
    targetState: "reconsidering",
    auditResponseKind: "reconsider",
    notificationKind: "vacancy.reconsider",
    titleForOrg: (seekerName, vacancyTitle) =>
      `${seekerName} would like to reconsider "${vacancyTitle}"`,
    bodyForOrg: () =>
      "They previously declined. If the role is still open, re-open the conversation through the dossier flow.",
    update: () => ({ state: "reconsidering" as const, respondedAt: new Date() }),
    requireCurrentState: "declined",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared respond() engine  one place that enforces ownership + state
// machine + notification fan-out + audit. Keeping the four entry
// points thin makes the per-state contract obvious from the call site.
// ─────────────────────────────────────────────────────────────────────────────

interface RespondConfig<TSchema extends z.ZodTypeAny> {
  input: z.infer<TSchema>;
  inputSchema: TSchema;
  targetState:
    | "accepted"
    | "accepted_with_notice"
    | "declined"
    | "reconsidering";
  auditResponseKind:
    | "accept"
    | "accept_with_notice"
    | "decline"
    | "reconsider";
  notificationKind: "vacancy.response" | "vacancy.reconsider";
  titleForOrg: (seekerName: string, vacancyTitle: string) => string;
  bodyForOrg: (seekerName: string, parsed: z.infer<TSchema>) => string;
  update: (parsed: z.infer<TSchema>) => Record<string, unknown>;
  /** Optional state-machine guard. Defaults to "must be invited". */
  requireCurrentState?: InvitationStateSeeker;
  extraAuditMeta?: (parsed: z.infer<TSchema>) => Record<string, unknown>;
}

async function respond<TSchema extends z.ZodTypeAny>(
  cfg: RespondConfig<TSchema>,
): Promise<ActionResult> {
  const session = await verifyRole("seeker");

  const parsedRes = cfg.inputSchema.safeParse(cfg.input);
  if (!parsedRes.success) {
    return fail(
      parsedRes.error.issues[0]?.message ?? "Invalid response input.",
    );
  }
  const parsed = parsedRes.data;
  const invitationId = (parsed as { invitationId: string }).invitationId;

  const db = getDb();

  // Load invitation + verify ownership. Same shape as getMyInvitation
  // but inline here so we get the orgId etc in one round trip without
  // re-running verifyRole.
  const rows = await db
    .select({
      id: schema.vacancyInvitations.id,
      state: schema.vacancyInvitations.state,
      vacancyId: schema.vacancyInvitations.vacancyId,
      profileId: schema.vacancyInvitations.profileId,
      ownerUserId: schema.profiles.userId,
      seekerDisplayName: schema.profiles.displayName,
      vacancyTitle: schema.vacancies.title,
      organizationId: schema.vacancies.organizationId,
    })
    .from(schema.vacancyInvitations)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.vacancyInvitations.profileId),
    )
    .innerJoin(
      schema.vacancies,
      eq(schema.vacancies.id, schema.vacancyInvitations.vacancyId),
    )
    .where(eq(schema.vacancyInvitations.id, invitationId))
    .limit(1);

  const row = rows[0];
  if (!row) return fail("Invitation not found.");
  if (row.ownerUserId !== session.id) {
    // Don't disclose existence  cross-seeker enumeration is impossible.
    return fail("Invitation not found.");
  }

  const expected = cfg.requireCurrentState ?? "invited";
  if (row.state !== expected) {
    if (expected === "invited") {
      return fail(
        "This invitation has already been responded to or has expired.",
      );
    }
    return fail(
      `You can only ${cfg.auditResponseKind} an invitation that is currently “${expected}”.`,
    );
  }

  // Conditional update  state-machine guard runs again at the DB
  // level so a concurrent expire-cron or duplicate submit can't race
  // past us.
  const updateResult = await db
    .update(schema.vacancyInvitations)
    .set(cfg.update(parsed))
    .where(
      and(
        eq(schema.vacancyInvitations.id, invitationId),
        eq(schema.vacancyInvitations.state, expected),
      ),
    )
    .returning({ id: schema.vacancyInvitations.id });

  if (updateResult.length === 0) {
    return fail(
      "Your response couldn't be saved  the invitation state changed in the meantime. Refresh and try again.",
    );
  }

  // Notify employer org members (notifyOrgMembers honours per-user
  // prefs + dedupe + the suspended/deleted guard).
  await notifyOrgMembers(row.organizationId, {
    kind: cfg.notificationKind,
    title: cfg.titleForOrg(row.seekerDisplayName, row.vacancyTitle),
    body: cfg.bodyForOrg(row.seekerDisplayName, parsed),
    link: `/employer/vacancies/${row.vacancyId}`,
    meta: { invitationId, vacancyId: row.vacancyId },
  });

  await logAccess({
    kind: "vacancy.response",
    actor: session.id,
    subject: invitationId,
    meta: {
      responseKind: cfg.auditResponseKind,
      vacancyId: row.vacancyId,
      orgId: row.organizationId,
      ...(cfg.extraAuditMeta?.(parsed) ?? {}),
    },
  });

  revalidatePath("/dashboard/invitations");
  revalidatePath(`/dashboard/invitations/${invitationId}`);
  return ok();
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
