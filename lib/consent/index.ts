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
