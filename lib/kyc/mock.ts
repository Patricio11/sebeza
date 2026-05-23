/**
 * Phase 8  Mock identity verifier.
 *
 * Used in dev + as the prod fallback when `feature_flag_kyc_provider`
 * is OFF. Returns "pending"  the admin manual-flip flow handles the
 * actual verification decision in that mode.
 */

import "server-only";
import type { IdentityVerifier, VerificationResult } from "./types";

export const mockIdentityVerifier: IdentityVerifier = {
  name: "mock",
  async verify(): Promise<VerificationResult> {
    return {
      ok: true,
      status: "pending",
      providerTransactionId: null,
      raw: { note: "MockIdentityVerifier  admin manual approval required." },
    };
  },
};
