/**
 * Phase 7 — Platform settings loader (read side).
 *
 * Reads from `platform_settings`. The write Server Action lives at
 * `lib/admin/settings-actions.ts` so this file can stay `"server-only"`
 * and be imported anywhere the ranking SQL / freshness band needs a
 * tunable value.
 *
 * Cache: per-request memoisation via React `cache()`. The DB hit is cheap
 * (a single primary-key lookup) and we don't want to over-engineer
 * invalidation — the admin write Action calls `revalidatePath` for every
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
  // Phase 7.5 — k-anonymity floor for the longitudinal outcomes
  // dataset. Cells with fewer than this many distinct profiles
  // are suppressed, with complementary suppression to stop value
  // recovery from row/column totals. Default 10.
  | "outcomes_min_cohort_size";

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
};

/**
 * Read a single setting. Returns the JSONB value as-is; the caller
 * narrows the type. Falls back to the bundled default if the row is
 * missing — so a brand-new DB without seeds still boots.
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
