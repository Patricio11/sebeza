"use server";

/**
 * Phase 11.3.3  Report-this-invite Server Action.
 *
 * One-click moderation report scoped to a specific vacancy invitation.
 * Writes to the existing `reports` table; the new columns
 * (`subjectOrgId`, `subjectInvitationId`) carry the context the admin
 * queue surfaces.
 *
 * D3: reporting does NOT auto-decline the invitation. Two different
 * decisions. The seeker can report tone + still accept the role on its
 * merits.
 *
 * Reason set extends the existing enum with three invite-specific
 * values (added in migration 0040): `irrelevant_role`,
 * `bad_faith_company`, `off_platform_contact_request`.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { notifyAllAdmins } from "@/lib/notifications/server";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export type ReportInviteReason =
  | "harassment"
  | "spam"
  | "inappropriate"
  | "irrelevant_role"
  | "bad_faith_company"
  | "off_platform_contact_request"
  | "other";

export const REPORT_INVITE_REASON_LABEL: Record<ReportInviteReason, string> = {
  harassment: "Harassment / abusive tone",
  spam: "Spam / mass-blast",
  inappropriate: "Inappropriate content",
  irrelevant_role: "The role doesn't match what was advertised",
  bad_faith_company: "Bad-faith company (MLM, scam, pay-to-apply)",
  off_platform_contact_request:
    "Asked me to take it off-platform (WhatsApp, personal email)",
  other: "Another reason",
};

const NOTE_MAX = 280;

export interface ReportInvitationInput {
  invitationId: string;
  reason: ReportInviteReason;
  note?: string;
}

export async function reportInvitation(
  input: ReportInvitationInput,
): Promise<ActionResult<{ reportId: string }>> {
  const me = await verifyRole("seeker");

  if (!REPORT_INVITE_REASON_LABEL[input.reason]) {
    return { ok: false, message: "Pick a reason from the list." };
  }
  const note = (input.note ?? "").trim();
  if (input.reason === "other" && note.length === 0) {
    return {
      ok: false,
      message: "Add a short note when picking 'Another reason'.",
    };
  }
  if (note.length > NOTE_MAX) {
    return {
      ok: false,
      message: `Note can't exceed ${NOTE_MAX} characters.`,
    };
  }

  const db = getDb();
  // Verify the invitation exists and resolve the org id for the report
  // context. We don't require the invitation to belong to the reporter
  // here -- the seeker invitations page already scopes the surface;
  // this is the defence-in-depth check.
  const inv = await db
    .select({
      id: schema.vacancyInvitations.id,
      profileId: schema.vacancyInvitations.profileId,
      vacancyId: schema.vacancyInvitations.vacancyId,
      orgId: schema.vacancies.organizationId,
    })
    .from(schema.vacancyInvitations)
    .innerJoin(
      schema.vacancies,
      eq(schema.vacancies.id, schema.vacancyInvitations.vacancyId),
    )
    .where(eq(schema.vacancyInvitations.id, input.invitationId))
    .limit(1);
  const row = inv[0];
  if (!row) return { ok: false, message: "Invitation not found." };

  // Confirm the reporter is the invited seeker.
  const myProfile = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, me.id))
    .limit(1);
  if (!myProfile[0] || myProfile[0].id !== row.profileId) {
    return { ok: false, message: "Only the invited seeker can report." };
  }

  const reportId = `rpt_${randomUUID()}`;
  await db.insert(schema.reports).values({
    id: reportId,
    // Invite reports point at the org + invitation rather than a
    // seeker profile (the existing profile-flag path stays available
    // on /p/[handle]).
    subjectProfileId: null,
    subjectOrgId: row.orgId,
    subjectInvitationId: row.id,
    reporterUserId: me.id,
    reason: input.reason,
    note: note.length > 0 ? note : null,
  });

  await logAccess({
    kind: "moderation.invite_report.created",
    actor: me.id,
    subject: reportId,
    meta: {
      invitationId: row.id,
      orgId: row.orgId,
      reason: input.reason,
      seekerAuthoredFreeText: note.length > 0,
    },
  });

  // Fan out to admins via the existing `moderation.reported` kind.
  await notifyAllAdmins({
    kind: "moderation.reported",
    title: `Invitation reported (${input.reason})`,
    body: `A seeker reported an invitation. Open /admin/moderation to review.`,
    link: "/admin/moderation",
    meta: {
      reportId,
      invitationId: row.id,
      orgId: row.orgId,
      reason: input.reason,
    },
  });

  revalidatePath(`/dashboard/invitations/${row.id}`);
  revalidatePath("/dashboard/invitations");
  revalidatePath("/admin/moderation");
  return { ok: true, reportId };
}
