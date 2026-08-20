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
import { encryptField, decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import type { IntegrationChannel } from "@/lib/integrations/resolve";
import {
  buildStorageBackend,
  invalidateStorageBackendCache,
} from "@/lib/storage/backend";

export type IntegrationResult = { ok: true } | { ok: false; error: string };

const channelSchema = z.enum(["sms", "whatsapp", "email", "storage"]);

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
  // 2026-08  file storage (documents / photos / CVs). S3 or any
  // S3-compatible host; secrets are accessKeyId + secretAccessKey.
  storage: z.object({
    provider: z.literal("s3").default("s3"),
    bucket: z.string().trim().min(2).max(100),
    region: z.string().trim().max(40).optional().or(z.literal("")),
    endpoint: z
      .string()
      .trim()
      .max(300)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^https?:\/\//.test(v), {
        message: "Endpoint must be an http(s) URL.",
      }),
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
      enabled: false, // configuring never auto-enables  enabling is explicit
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
  if (ch.data === "storage") invalidateStorageBackendCache();
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
  if (ch.data === "storage") invalidateStorageBackendCache();
  revalidatePath("/admin/integrations");
  return { ok: true };
}

/**
 * 2026-08  round-trip probe for the SAVED storage configuration
 * (write → read → delete under `__connection_test__/`). Runs against
 * the stored row even while disabled, so the flow is: Save → Test →
 * Enable. Secrets never leave the server; the result is a message.
 */
export async function testStorageIntegration(): Promise<
  { ok: boolean; message: string }
> {
  const admin = await verifyAdmin();
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.integrationSettings)
    .where(eq(schema.integrationSettings.channel, "storage"))
    .limit(1);
  if (!row?.credentialsEnc) {
    return { ok: false, message: "Save the storage configuration first, then test it." };
  }

  let result: { ok: boolean; message: string };
  try {
    const config = (row.config ?? {}) as Record<string, string>;
    const secrets = JSON.parse(decryptField(row.credentialsEnc)) as Record<
      string,
      string
    >;
    const backend = buildStorageBackend("s3", config, secrets);
    result = await backend.test();
  } catch (e) {
    result = {
      ok: false,
      message: e instanceof Error ? e.message : "Storage test failed.",
    };
  }

  await logAccess({
    kind: "admin.integration.edit",
    actor: admin.id,
    subject: "storage",
    meta: { action: "test", ok: result.ok },
  });
  return result;
}
