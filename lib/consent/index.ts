/**
 * Consent state machine (UX_UI_SPEC §5 Phase 2.3).
 *
 * State transitions: none → granted(version) → revoked.
 * A profile is NOT searchable until `searchability` consent has been granted.
 *
 * Phase 2 wires this to the `consents` Drizzle table. For Phase 1 we expose
 * the shape so the seeker dashboard / privacy centre UI compile.
 */

export const CONSENT_PURPOSES = [
  "searchability",
  "contact_reveal",
  "document_sharing",
  "analytics_aggregate",
  // Phase 7.5  opt-in inclusion in the longitudinal education-to-
  // employment outcomes dataset (`/insights` outcomes section + the
  // Phase 9 `/gov` portal). Optional, default-off, **non-degrading**:
  // withholding it must NOT weaken job-search in any way (it's a
  // lawfulness condition, not a UX preference).
  "outcomes_research",
  // Phase 9.8.3  opt-in to receive vacancy invitations from verified
  // employers (an employer flags a seeker for a SPECIFIC named role).
  // Optional, default-off, **non-degrading**: a seeker who has NOT
  // granted this is still searchable + contactable exactly as today;
  // they simply don't receive vacancy invites. The 9.8.4 invite
  // action checks `hasVacancyMatchingConsent(userId)` at the action
  // boundary; bulk-invite skips non-consented seekers with a soft UX
  // summary ("3 not eligible right now"), recording the actual reason
  // in the audit log only (per D5 — never in UI, to avoid leaking
  // consent state).
  "vacancy_matching",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export type ConsentState = "none" | "granted" | "revoked";

export interface ConsentRecord {
  purpose: ConsentPurpose;
  state: ConsentState;
  /** Catalog version of the consent copy the user actually saw. */
  version: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

export const REQUIRED_FOR_SEARCHABILITY: ConsentPurpose[] = ["searchability"];

export function isSearchable(records: ConsentRecord[]): boolean {
  return REQUIRED_FOR_SEARCHABILITY.every((p) =>
    records.some((r) => r.purpose === p && r.state === "granted"),
  );
}
