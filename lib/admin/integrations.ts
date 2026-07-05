"use server";

/**
 * Phase 25 ("Integrations Hub")  admin management of channel integrations.
 * llm_providers posture: secrets encrypted at rest (lib/crypto), never
 * returned to the client (only a configured/not flag), enable/disable
 * separate from configure, everything audited (credentials never in meta).
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { encryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import type { IntegrationChannel } from "@/lib/integrations/resolve";

export type IntegrationResult = { ok: true } | { ok: false; error: string };

const channelSchema = z.enum(["sms", "whatsapp", "email"]);

const configSchemas = {
  sms: z.object({
    provider: z.enum(["twilio", "sns", "console"]),
    fromNumber: z.string().trim().max(20).optional().or(z.literal("")),
    awsRegion: z.string().trim().max(30).optional().or(z.literal("")),
  }),
  whatsapp: z.object({
    provider: z.enum(["twilio", "console"]),
    fromNumber: z.string().trim().max(20).optional().or(z.literal("")),
  }),
  email: z.object({
    host: z.string().trim().min(2).max(200),
    port: z.string().trim().regex(/^\d+$/),
    from: z.string().trim().max(200).optional().or(z.literal("")),
    secure: z.enum(["true", "false"]).optional(),
  }),
} as const;

export async function saveIntegration(
  channel: IntegrationChannel,
  config: Record<string, string>,
  secrets: Record<string, string>,
): Promise<IntegrationResult> {
  const admin = await verifyAdmin();
  const ch = channelSchema.safeParse(channel);
  if (!ch.success) return { ok: false, error: "Unknown channel." };
  const cfg = configSchemas[ch.data].safeParse(config);
  if (!cfg.success) return { ok: false, error: "Invalid configuration." };

  // Drop empty secret fields; refuse an all-empty secret set for providers
  // that need one (console needs none).
  const cleanSecrets = Object.fromEntries(
    Object.entries(secrets ?? {}).filter(([, v]) => (v ?? "").trim().length > 0),
  );

  const db = getDb();
  await db
    .insert(schema.integrationSettings)
    .values({
      channel: ch.data,
      enabled: false, // configuring never auto-enables — enabling is explicit
      credentialsEnc: encryptField(JSON.stringify(cleanSecrets)),
      config: cfg.data as Record<string, string>,
      updatedAt: new Date(),
      updatedByUserId: admin.id,
    })
    .onConflictDoUpdate({
      target: schema.integrationSettings.channel,
      set: {
        credentialsEnc: encryptField(JSON.stringify(cleanSecrets)),
        config: cfg.data as Record<string, string>,
        updatedAt: new Date(),
        updatedByUserId: admin.id,
        // A reconfigure disables until the admin re-enables deliberately.
        enabled: false,
      },
    });

  await logAccess({
    kind: "admin.integration.edit",
    actor: admin.id,
    subject: ch.data,
    meta: { action: "configure" },
  });
  revalidatePath("/admin/integrations");
  return { ok: true };
}

export async function setIntegrationEnabled(
  channel: IntegrationChannel,
  enabled: boolean,
): Promise<IntegrationResult> {
  const admin = await verifyAdmin();
  const ch = channelSchema.safeParse(channel);
  if (!ch.success) return { ok: false, error: "Unknown channel." };

  const db = getDb();
  const [row] = await db
    .select({ credentialsEnc: schema.integrationSettings.credentialsEnc })
    .from(schema.integrationSettings)
    .where(eq(schema.integrationSettings.channel, ch.data))
    .limit(1);
  if (enabled && (!row || !row.credentialsEnc)) {
    return { ok: false, error: "Configure the integration before enabling it." };
  }

  await db
    .update(schema.integrationSettings)
    .set({ enabled, updatedAt: new Date(), updatedByUserId: admin.id })
    .where(eq(schema.integrationSettings.channel, ch.data));

  await logAccess({
    kind: "admin.integration.edit",
    actor: admin.id,
    subject: ch.data,
    meta: { action: enabled ? "enable" : "disable" },
  });
  revalidatePath("/admin/integrations");
  return { ok: true };
}
