/**
 * Phase 7  Platform settings loader (read side).
 *
 * Reads from `platform_settings`. The write Server Action lives at
 * `lib/admin/settings-actions.ts` so this file can stay `"server-only"`
 * and be imported anywhere the ranking SQL / freshness band needs a
 * tunable value.
 *
 * Cache: per-request memoisation via React `cache()`. The DB hit is cheap
 * (a single primary-key lookup) and we don't want to over-engineer
 * invalidation  the admin write Action calls `revalidatePath` for every
 * surface that consumes a setting.
 */

import "server-only";
import { cache } from "react";
import { getDb } from "@/db/client";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type SettingKey =
  | "freshness_band_days_fresh"
  | "freshness_band_days_ageing"
  | "ranking_weight_freshness"
  | "ranking_weight_completeness"
  | "ranking_weight_citizen_boost"
  | "feature_flag_2fa_enforced"
  | "feature_flag_email_notifications"
  | "feature_flag_gov_portal"
  // Phase 7.5  k-anonymity floor for the longitudinal outcomes
  // dataset. Cells with fewer than this many distinct profiles
  // are suppressed, with complementary suppression to stop value
  // recovery from row/column totals. Default 10.
  | "outcomes_min_cohort_size"
  // Phase 8  gate the real KYC SaaS adapter. Off by default until
  // partnership + provider are confirmed; until then the mock
  // verifier runs (admin manual approval flow).
  | "feature_flag_kyc_provider"
  // Phase 8  gate the SAQA async worker. Off by default until
  // SAQA NLRD partnership is confirmed; until then admin "Approve"
  // on /admin/verifications flips qualifications directly (Phase 7
  // behaviour).
  | "feature_flag_saqa_worker"
  // Phase 9.7.3  Skills-Shortage Justification Index thresholds.
  // All four are explicit, plain-language knobs (no black-box score):
  //   demand_score          = COUNT(DISTINCT actor_org_id) / 10 in
  //                           the trailing 30-day window
  //   local_supply_ratio    = sa_supply / (demand_score × 10)
  //   foreign_fill_share    = foreign_placements / total_placements
  //   total_placements      = employer_confirmed only
  // Classifier (D1, 2026-05-24):
  //   shortage          if demand >= demand_floor
  //                     AND local_supply_ratio < local_supply_threshold
  //                     AND foreign_fill_share >= foreign_fill_floor
  //                     AND total_placements >= employer_mix_min_placements
  //   supply_available  if demand >= demand_floor
  //                     AND local_supply_ratio >= 1.0
  //   indeterminate     otherwise (shown blank, not guessed)
  | "lmi_demand_floor"
  | "lmi_local_supply_threshold"
  | "lmi_foreign_fill_floor"
  // Reused by 9.7.6 (per-employer governed lookup)  one floor,
  // not two diverging knobs.
  | "employer_mix_min_placements"
  // Phase 9.7.6  per-employer governed lookup gate. Default OFF;
  // ships dormant. Activation pairs with a concrete operational need
  // (purpose-limitation, retention, named operators become concrete
  // at that point). Same dormant-by-default posture as KYC + SAQA.
  | "feature_flag_employer_mix_lookup"
  // Phase 9.16.1  global show/hide for VerificationBadge.
  // Default ON  matches current behaviour, no surprise on deploy.
  // Flipping OFF hides every state (verified / pending / unverified /
  // rejected) across every surface, public + employer + seeker. Useful
  // as a transitional knob while SAQA + KYC verification volume is
  // still thin and the badge would be more noise than signal. Honest
  // either way: the column still exists, the rule still holds
  // we just don't paint anything.
  | "feature_flag_verification_badges_visible"
  // ──────────────────────────────────────────────────────────────────────
  // Phase 11.4.4  SMS + WhatsApp outbound notification channels.
  // BOTH default OFF; ships dormant. Even when an admin flips one or
  // both ON, the dispatch layer ADDITIONALLY requires (per channel):
  //   (a) the seeker's per-purpose consent
  //   (b) the seeker's per-channel app_user flag
  //   (c) the seeker's phone_verified_at IS NOT NULL
  //   (d) a row in seeker_sms_allowlist for the seeker
  // Multi-gate by design  no external provider is contacted until
  // an admin explicitly approves every single one. Zero spend by
  // default.
  // ──────────────────────────────────────────────────────────────────────
  | "feature_flag_sms_channel_enabled"
  | "feature_flag_whatsapp_channel_enabled"
  // Phase 11.4.4 D6  SAST-hardcoded quiet hours. The dispatch layer
  // refuses to send between these (inclusive start, exclusive end).
  // Hours are integers in [0..23] expressed in UTC+2. Defaults match
  // the plan: 21:00 SAST  07:00 SAST.
  | "feature_flag_sms_quiet_hours_start"
  | "feature_flag_sms_quiet_hours_end";

const DEFAULTS: Record<SettingKey, unknown> = {
  freshness_band_days_fresh: 30,
  freshness_band_days_ageing: 90,
  ranking_weight_freshness: 1.0,
  ranking_weight_completeness: 1.0,
  ranking_weight_citizen_boost: 1.08,
  feature_flag_2fa_enforced: false,
  feature_flag_email_notifications: false,
  feature_flag_gov_portal: false,
  outcomes_min_cohort_size: 10,
  feature_flag_kyc_provider: false,
  feature_flag_saqa_worker: false,
  // Phase 9.7.3  see SettingKey doc-comments above.
  lmi_demand_floor: 1.0,
  lmi_local_supply_threshold: 0.5,
  lmi_foreign_fill_floor: 0.5,
  employer_mix_min_placements: 5,
  feature_flag_employer_mix_lookup: false,
  feature_flag_verification_badges_visible: true,
  // Phase 11.4.4  all four default to OFF / SAST 2107. Dormant ship.
  feature_flag_sms_channel_enabled: false,
  feature_flag_whatsapp_channel_enabled: false,
  feature_flag_sms_quiet_hours_start: 21,
  feature_flag_sms_quiet_hours_end: 7,
};

/**
 * Read a single setting. Returns the JSONB value as-is; the caller
 * narrows the type. Falls back to the bundled default if the row is
 * missing  so a brand-new DB without seeds still boots.
 */
export const getSetting = cache(async <T = unknown>(key: SettingKey): Promise<T> => {
  const db = getDb();
  const rows = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (rows.length === 0 || rows[0]?.value === undefined) {
    return DEFAULTS[key] as T;
  }
  return rows[0].value as T;
});

/**
 * Read every known setting in one go. Used by `/admin/settings` to
 * render the editor. Falls back to defaults per key.
 */
export async function getAllSettings(): Promise<Record<SettingKey, unknown>> {
  const db = getDb();
  const rows = await db
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings);
  const map: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map as Record<SettingKey, unknown>;
}

export { DEFAULTS as SETTING_DEFAULTS };
