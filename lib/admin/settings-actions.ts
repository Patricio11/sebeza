"use server";

/**
 * Phase 7  Platform settings write Server Action.
 *
 * Lives separately from `lib/admin/settings.ts` (which is `"server-only"`
 * and imported by ranking SQL / freshness band code) because a single
 * file can be either `"server-only"` OR `"use server"`, not both.
 *
 * Every update is audit-logged with the prior + new value so we can
 * reconstruct any ranking-weight change retrospectively.
 */

import { getDb } from "@/db/client";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import type { SettingKey } from "@/lib/admin/settings";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// Per-key value schemas. We keep these tight: bad ranking weights are
// far worse than a friendly error.
const KEY_SCHEMAS = {
  freshness_band_days_fresh: z.number().int().min(1).max(365),
  freshness_band_days_ageing: z.number().int().min(2).max(730),
  ranking_weight_freshness: z.number().min(0).max(5),
  ranking_weight_completeness: z.number().min(0).max(5),
  ranking_weight_citizen_boost: z.number().min(1).max(2),
  feature_flag_2fa_enforced: z.boolean(),
  feature_flag_email_notifications: z.boolean(),
  feature_flag_gov_portal: z.boolean(),
  // Phase 7.5  never lower than 5 (a 5-person cell still allows
  // re-identification of small SA programmes). 10 is the documented
  // default; admins can raise it but should think very hard before
  // dropping it.
  outcomes_min_cohort_size: z.number().int().min(5).max(200),
  feature_flag_kyc_provider: z.boolean(),
  feature_flag_saqa_worker: z.boolean(),
  // Phase 9.7.3  Justification Index thresholds.
  //   demand floor is a "tens of distinct employers" scale; under 0.3
  //   means fewer than 3 different employers searched in 30 days
  //   too thin to call a shortage anywhere.
  lmi_demand_floor: z.number().min(0.3).max(10),
  //   ratio < 1.0 = under-supplied; 0.5 is the documented default.
  //   Capped at 5 so an admin can't make every cell a "shortage" by
  //   raising the threshold above any realistic supply ratio.
  lmi_local_supply_threshold: z.number().min(0.1).max(5),
  //   share of confirmed placements that went to foreign nationals;
  //   defaults to 0.5 (majority). Floor of 0.1 so the cell-tag
  //   condition is not effectively-always-true.
  lmi_foreign_fill_floor: z.number().min(0.1).max(1),
  //   never lower than 3  a 2-placement cell with a 50/50 split
  //   re-identifies via the platform's own audit log.
  employer_mix_min_placements: z.number().int().min(3).max(200),
  // Phase 9.7.6  dormant-by-default gate on the per-employer
  // governed lookup. Engine + UI ship; flag enables the form.
  feature_flag_employer_mix_lookup: z.boolean(),
  // Phase 9.16.1  global show/hide for VerificationBadge.
  feature_flag_verification_badges_visible: z.boolean(),
  // Phase 11.4.4  SMS + WhatsApp channel gates. Default OFF. Even
  // when flipped ON, the dispatch layer still requires per-seeker
  // consent + verified phone + allowlist row. Zero spend without
  // four-way agreement.
  feature_flag_sms_channel_enabled: z.boolean(),
  feature_flag_whatsapp_channel_enabled: z.boolean(),
  feature_flag_sms_quiet_hours_start: z.number().int().min(0).max(23),
  feature_flag_sms_quiet_hours_end: z.number().int().min(0).max(23),
  // Phase 13.3  LLM kill-switch. Default OFF; admin flips ON only
  // after configuring + testing a provider on /admin/llm. Zero spend
  // posture mirrors SMS / WhatsApp.
  feature_flag_llm_curriculum_enabled: z.boolean(),
} as const satisfies Record<SettingKey, z.ZodTypeAny>;

const updateSchema = z.object({
  key: z.enum([
    "freshness_band_days_fresh",
    "freshness_band_days_ageing",
    "ranking_weight_freshness",
    "ranking_weight_completeness",
    "ranking_weight_citizen_boost",
    "feature_flag_2fa_enforced",
    "feature_flag_email_notifications",
    "feature_flag_gov_portal",
    "outcomes_min_cohort_size",
    "feature_flag_kyc_provider",
    "feature_flag_saqa_worker",
    "lmi_demand_floor",
    "lmi_local_supply_threshold",
    "lmi_foreign_fill_floor",
    "employer_mix_min_placements",
    "feature_flag_employer_mix_lookup",
    "feature_flag_verification_badges_visible",
    "feature_flag_sms_channel_enabled",
    "feature_flag_whatsapp_channel_enabled",
    "feature_flag_sms_quiet_hours_start",
    "feature_flag_sms_quiet_hours_end",
    "feature_flag_llm_curriculum_enabled",
  ] as const),
  value: z.unknown(),
});

export async function updateSetting(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid setting key.");

  // Cross-validate the band order so an admin can't accidentally
  // invert the freshness band (ageing must be > fresh).
  const valueSchema = KEY_SCHEMAS[parsed.data.key];
  const valueParsed = valueSchema.safeParse(parsed.data.value);
  if (!valueParsed.success) {
    return fail(valueParsed.error.issues[0]?.message ?? "Invalid value.");
  }

  const db = getDb();
  const prior = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, parsed.data.key))
    .limit(1);

  if (
    parsed.data.key === "freshness_band_days_fresh" ||
    parsed.data.key === "freshness_band_days_ageing"
  ) {
    const otherKey =
      parsed.data.key === "freshness_band_days_fresh"
        ? "freshness_band_days_ageing"
        : "freshness_band_days_fresh";
    const otherRow = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, otherKey))
      .limit(1);
    const other = otherRow[0]?.value as number | undefined;
    const next = valueParsed.data as number;
    if (typeof other === "number") {
      if (parsed.data.key === "freshness_band_days_fresh" && next >= other) {
        return fail("Fresh days must be less than ageing days.");
      }
      if (parsed.data.key === "freshness_band_days_ageing" && next <= other) {
        return fail("Ageing days must be greater than fresh days.");
      }
    }
  }

  await db
    .insert(platformSettings)
    .values({
      key: parsed.data.key,
      value: valueParsed.data,
      updatedAt: new Date(),
      updatedByUserId: session.id,
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: valueParsed.data,
        updatedAt: new Date(),
        updatedByUserId: session.id,
      },
    });

  await logAccess({
    kind: "setting.update",
    actor: session.id,
    subject: parsed.data.key,
    meta: {
      prior: prior[0]?.value ?? null,
      next: valueParsed.data,
    },
  });

  // Settings influence search ranking, the freshness band, and gated
  // surfaces. Invalidate everything that consumes them.
  revalidatePath("/admin/settings");
  revalidatePath("/search");
  revalidatePath("/insights");
  return ok();
}
