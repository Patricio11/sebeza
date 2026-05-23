/**
 * Phase 8 — Identity / KYC verifier interface.
 *
 * The boundary we own. Implementations: `MockIdentityVerifier` (always
 * the dev path; also the prod fallback when the partnership flag is
 * off) and `ThirdPartyKycVerifier` (one of truID / SmileID / iiDENTIFii
 * — picked at deploy via `KYC_PROVIDER` env). We do NOT call Home
 * Affairs directly — the licensed SA SaaS providers all wrap the
 * eHANIS integration and carry the necessary DPA terms.
 *
 * Provider switch is BOTH:
 *   1. `KYC_PROVIDER` env var (mock | truid | smileid | iidentifii)
 *   2. `platform_settings.feature_flag_kyc_provider` flag (boolean)
 *
 * If the flag is OFF, the provider resolves to Mock regardless of the
 * env var. This is the user's standing instruction: KYC stays dormant
 * until an admin flips the flag after partnership confirmation.
 */

import "server-only";

export interface IdentityVerifierInput {
  /** Encrypted ID number (the caller decrypts before passing). */
  idNumber: string;
  /** Display name on the ID. */
  fullName: string;
  /** ISO yyyy-mm-dd. */
  dob?: string;
}

export type VerificationResult =
  | { ok: true; status: "verified" | "mismatch" | "pending" | "unknown"; providerTransactionId: string | null; raw?: Record<string, unknown> }
  | { ok: false; message: string };

export interface IdentityVerifier {
  /** Human-readable provider name for audit-log meta. */
  name: string;
  verify(input: IdentityVerifierInput): Promise<VerificationResult>;
}
