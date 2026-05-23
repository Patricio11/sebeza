"use server";

/**
 * Phase 7 — Platform settings write Server Action.
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
