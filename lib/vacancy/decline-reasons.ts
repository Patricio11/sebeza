/**
 * Decline reasons: the vocabulary, with no database attached.
 *
 * These constants used to live in `db/queries/decline-reasons.ts`
 * alongside the aggregate queries. That was fine until a CLIENT
 * component needed a label: importing the query module dragged
 * `postgres` into the browser bundle and the build failed with
 * "Can't resolve 'fs'".
 *
 * So the vocabulary lives here, importable from anywhere, and the query
 * module re-exports it. One source of truth, no server code on the wire.
 */

export type DeclineReasonValue =
  | "already_employed"
  | "salary_not_competitive"
  | "location_not_feasible"
  | "skills_mismatch"
  | "role_not_what_im_looking_for"
  | "other"
  | "unspecified";

export const DECLINE_REASON_VALUES: DeclineReasonValue[] = [
  "already_employed",
  "salary_not_competitive",
  "location_not_feasible",
  "skills_mismatch",
  "role_not_what_im_looking_for",
  "other",
  "unspecified",
];

/** Human-readable labels for the breakdown UI. Order matches
 *  `DECLINE_REASON_VALUES` so the rendering is stable. */
export const DECLINE_REASON_LABEL: Record<DeclineReasonValue, string> = {
  already_employed: "Already employed",
  salary_not_competitive: "Salary not competitive",
  location_not_feasible: "Location not feasible",
  skills_mismatch: "Skills mismatch",
  role_not_what_im_looking_for: "Not the right role",
  other: "Other",
  unspecified: "No reason given",
};
