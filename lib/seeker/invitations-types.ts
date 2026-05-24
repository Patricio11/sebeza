/**
 * Phase 9.8.5  Shared types + label catalog for the seeker
 * invitation surfaces.
 *
 * Lives in a plain module (not `"use server"`) because the runtime
 * label constants are imported by client islands  the
 * `InvitationResponseIsland` decline-reason picker needs the same
 * canonical labels the Server Action uses in its notification body.
 */

export type InvitationStateSeeker =
  | "invited"
  | "accepted"
  | "accepted_with_notice"
  | "declined"
  | "reconsidering"
  | "withdrawn"
  | "expired";

export type DeclineReasonValue =
  | "already_employed"
  | "salary_not_competitive"
  | "location_not_feasible"
  | "skills_mismatch"
  | "role_not_what_im_looking_for"
  | "other";

export const DECLINE_REASON_LABEL: Record<DeclineReasonValue, string> = {
  already_employed: "I'm already employed",
  salary_not_competitive: "The salary isn't competitive",
  location_not_feasible: "The location isn't feasible for me",
  skills_mismatch: "The skills don't match what I do",
  role_not_what_im_looking_for: "Not the kind of role I'm looking for",
  other: "Other (please add a short note)",
};

/** Row shape returned to the seeker dashboard. The employer side has a
 *  richer row in `lib/employer/invitations.ts`; here we expose only
 *  what the seeker needs to make a response decision. */
export interface SeekerInvitationRow {
  id: string;
  state: InvitationStateSeeker;
  invitedAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
  noticePeriodMonths: number | null;
  declineReason: DeclineReasonValue | null;
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
}
