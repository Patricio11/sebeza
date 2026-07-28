/**
 * Phase 32.1.3 (security remediation)  types + constants for the
 * report-an-invite flow, split out of `report-invite.ts`.
 *
 * Why the split: `report-invite.ts` carries `"use server"`, and a module
 * with that directive may only export async functions  everything else
 * is a footgun. `REPORT_INVITE_REASON_LABEL` in particular is imported
 * by the CLIENT component `components/feature/seeker/ReportInvitationControl.tsx`,
 * which means a client bundle was reaching into a Server Action module
 * for a plain object. House convention (`*-types.ts` siblings, as used
 * by `lib/employer/*-types.ts` and `lib/seeker/*-types.ts`) keeps the
 * two concerns apart.
 */

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

export interface ReportInvitationInput {
  invitationId: string;
  reason: ReportInviteReason;
  note?: string;
}
