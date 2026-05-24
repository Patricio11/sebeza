/**
 * Phase 9.8.1  shared types + label catalogs for the vacancies surface.
 *
 * Lives in a plain module (not `"use server"`) because runtime label
 * constants used by the form / list components need to be importable
 * from client islands.
 */

export type VacancyStatus = "draft" | "open" | "closed" | "filled";

export const VACANCY_STATUS_LABEL: Record<VacancyStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  filled: "Filled",
};

/** Tone hint for chips/badges  consistent with StatusChip vocabulary. */
export const VACANCY_STATUS_TONE: Record<
  VacancyStatus,
  "muted" | "brand" | "neutral" | "accent"
> = {
  draft: "muted",
  open: "brand",
  closed: "neutral",
  filled: "accent",
};

/** What an employer-org member is allowed to do with vacancies, per the
 *  existing `orgMemberRole` enum (`db/schema.ts:85`). Owners + Recruiters
 *  can create + invite; Viewers are strictly read-only. Enforced server-
 *  side; the UI hides the buttons it can't action. */
export type OrgMemberRole = "owner" | "recruiter" | "viewer";

export function canEditVacancies(role: OrgMemberRole | null): boolean {
  return role === "owner" || role === "recruiter";
}

/** Visible to Owner + Recruiter only. Viewers don't see the salary band. */
export function canSeeSalary(role: OrgMemberRole | null): boolean {
  return role === "owner" || role === "recruiter";
}
