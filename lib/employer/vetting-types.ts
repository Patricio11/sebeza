/**
 * Phase 9.10  Shared types + label catalog for the org-vetting
 * surface.
 *
 * Lives in a plain module (not `"use server"`) because the label
 * catalogue + the type aliases are imported by client islands (the
 * onboarding form). The `vetting.ts` module is `"use server"` and
 * exports only async Server Actions.
 */

export type OrgDocumentKind =
  | "company_reg_cert"
  | "tax_clearance"
  | "proof_of_address"
  | "bank_confirmation"
  | "other";

export const ORG_DOCUMENT_LABEL: Record<OrgDocumentKind, string> = {
  company_reg_cert: "Company registration certificate (CIPC / CK1 / CK2)",
  tax_clearance: "Tax clearance certificate (SARS)",
  proof_of_address: "Proof of physical address  3 months old",
  bank_confirmation: "Bank confirmation letter",
  other: "Other supporting document (optional)",
};

export const REQUIRED_DOC_KINDS: OrgDocumentKind[] = [
  "company_reg_cert",
  "tax_clearance",
  "proof_of_address",
  "bank_confirmation",
];

export interface OrgDocumentRow {
  id: string;
  kind: OrgDocumentKind;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface OrgVettingState {
  orgId: string;
  orgName: string;
  registrationNumber: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  companyAddress: string | null;
  vatNumber: string | null;
  verification: "unverified" | "pending" | "verified" | "rejected";
  rejectionReason: string | null;
  adminNote: string | null;
  emailVerified: boolean;
  /** True iff the caller is the Owner of this org (per orgMemberRole).
   *  Recruiter / Viewer can read the state but not submit. */
  isOwner: boolean;
  documents: OrgDocumentRow[];
}
