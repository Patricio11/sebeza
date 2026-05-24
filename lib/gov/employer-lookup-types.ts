/**
 * Phase 9.7.6  shared types + label catalog for the per-employer
 * governed lookup. Lives in its own module because the action file
 * (`employer-lookup.ts`) is `"use server"` and can only export async
 * functions; runtime constants and type aliases consumed by the UI
 * have to ship from a plain module.
 */

export type LookupReason =
  | "compliance_check"
  | "incentive_verification"
  | "mandated_audit"
  | "other";

export const REASON_LABELS: Record<LookupReason, string> = {
  compliance_check: "Compliance check (general policy follow-up)",
  incentive_verification: "Local-hiring incentive verification",
  mandated_audit: "Mandated audit (regulator request)",
  other: "Other (note required)",
};

export interface LookupInput {
  orgName?: string;
  registrationNumber?: string;
  reason: LookupReason;
  reasonNote?: string;
}

export type LookupResult =
  | {
      ok: true;
      orgFound: false;
      floor: number;
    }
  | {
      ok: true;
      orgFound: true;
      orgId: string;
      orgName: string;
      registrationNumber: string | null;
      total: number;
      aboveFloor: false;
      floor: number;
      firstHireAt: null;
      lastHireAt: null;
    }
  | {
      ok: true;
      orgFound: true;
      orgId: string;
      orgName: string;
      registrationNumber: string | null;
      total: number;
      sa_citizen: number;
      foreign_national: number;
      aboveFloor: true;
      floor: number;
      firstHireAt: string | null;
      lastHireAt: string | null;
    }
  | { ok: false; message: string };
