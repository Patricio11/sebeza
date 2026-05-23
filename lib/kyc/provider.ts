/**
 * Phase 8 — KYC provider resolver.
 *
 * Provider switch obeys BOTH gates:
 *   1. `platform_settings.feature_flag_kyc_provider` (admin-controlled
 *      master switch — flipped only after partnership confirmation).
 *   2. `KYC_PROVIDER` env var (which SaaS to call when the flag is on).
 *
 * Until both align, the Mock provider runs. This is the user's standing
 * instruction: KYC stays dormant until an admin turns it on.
 *
 * Adding a new provider:
 *   1. Drop a `lib/kyc/providers/<slug>.ts` exporting an `IdentityVerifier`.
 *   2. Wire it in `KNOWN_PROVIDERS` below.
 *   3. Set `KYC_PROVIDER=<slug>` in env + flip the flag in /admin/settings.
 */

import "server-only";
import { getSetting } from "@/lib/admin/settings";
import { mockIdentityVerifier } from "./mock";
import type { IdentityVerifier } from "./types";

// Real provider modules go here when a partnership lands. Until then
// the map is empty and every code path resolves to mock.
const KNOWN_PROVIDERS: Record<string, IdentityVerifier> = {
  // truid: truIdVerifier,
  // smileid: smileIdVerifier,
  // iidentifii: iidentifiiVerifier,
};

export async function resolveIdentityVerifier(): Promise<IdentityVerifier> {
  const enabled = await getSetting<boolean>("feature_flag_kyc_provider");
  if (!enabled) return mockIdentityVerifier;
  const choice = (process.env.KYC_PROVIDER ?? "mock").toLowerCase();
  if (choice === "mock") return mockIdentityVerifier;
  const provider = KNOWN_PROVIDERS[choice];
  if (!provider) {
    // eslint-disable-next-line no-console
    console.warn(
      `[kyc] Flag is ON but KYC_PROVIDER="${choice}" not registered — falling back to mock.`,
    );
    return mockIdentityVerifier;
  }
  return provider;
}
