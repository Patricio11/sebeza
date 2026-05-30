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
  /**
   * Phase 11.3.5  verification tier of the inviting org. Surfaced on
   * the seeker's invitation card + detail so the seeker can tell at a
   * glance whether this is a Sebenza-verified employer.
   */
  orgVerification: "unverified" | "pending" | "verified" | "rejected";
  /**
   * Phase 9.21  vacancy-side season window. Surfaced on the seeker
   * detail page when present so the seeker can read the months before
   * accepting / declining. NULL when the vacancy didn't declare a
   * window (D0  blank means no constraint). The seeker never has a
   * window of their own (D2); this is read-only context.
   */
  seasonalWindow: import("@/lib/mock/types").SeasonalWindow | null;
  /**
   * Phase 11.3.4  vacancy spec frozen at invitation-send time. Null
   * for pre-migration invitations; the UI falls back to the live
   * `description` + a "may have changed" annotation.
   */
  vacancySnapshot: VacancySnapshot | null;
}

/**
 * Phase 11.3.4  the frozen-at-send-time vacancy snapshot shape. Mirrors
 * the relevant subset of `vacancies` columns the seeker needs to
 * evaluate the role. Stored as jsonb on `vacancy_invitations`; the
 * jsonb column is typed as `unknown` server-side  pass through a
 * runtime guard before rendering.
 */
export interface VacancySnapshot {
  title: string;
  description: string | null;
  professionSlug: string;
  provinceSlug: string;
  citySlug: string | null;
  seniority: string | null;
  skillSlugs: string[];
  workAvailability: string[];
  minYearsExperience: number | null;
  minNqfLevel: number | null;
  salaryBand: string | null;
  /** ISO timestamp the snapshot was captured. */
  capturedAt: string;
}

export function isVacancySnapshot(v: unknown): v is VacancySnapshot {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["title"] === "string" &&
    typeof r["professionSlug"] === "string" &&
    typeof r["provinceSlug"] === "string" &&
    Array.isArray(r["skillSlugs"]) &&
    typeof r["capturedAt"] === "string"
  );
}
