/**
 * Phase 25 ("Integrations Hub")  resolution layer between the admin-managed
 * `integration_settings` rows and the legacy env vars.
 *
 * Contract: an ENABLED admin row with decryptable credentials wins; otherwise
 * the transports fall back to their historical env-var behaviour unchanged.
 * `source` tells the hub (and the operator) which one is live.
 */

import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";

export type IntegrationChannel = "sms" | "whatsapp" | "email";

export interface ResolvedIntegration {
  /** Non-secret config merged for display + transport use. */
  config: Record<string, string>;
  /** Decrypted secrets (never returned to any client component). */
  secrets: Record<string, string>;
}

/**
 * The enabled admin-managed settings for a channel, or null (→ env fallback).
 * Never throws: an undecryptable row degrades to null + the env path, so a
 * key rotation can't take messaging down.
 */
export async function resolveIntegration(
  channel: IntegrationChannel,
): Promise<ResolvedIntegration | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.integrationSettings)
      .where(eq(schema.integrationSettings.channel, channel))
      .limit(1);
    if (!row || !row.enabled || !row.credentialsEnc) return null;
    const secrets = JSON.parse(decryptField(row.credentialsEnc)) as Record<
      string,
      string
    >;
    return { config: row.config ?? {}, secrets };
  } catch {
    return null;
  }
}

export type IntegrationSource = "admin" | "env" | "none";

/** Which source is live for a channel  hub display only (no secrets). */
export async function integrationSource(
  channel: IntegrationChannel,
): Promise<IntegrationSource> {
  const admin = await resolveIntegration(channel);
  if (admin) return "admin";
  const envConfigured =
    channel === "sms"
      ? !!process.env.SMS_PROVIDER
      : channel === "whatsapp"
        ? !!process.env.WHATSAPP_PROVIDER
        : !!process.env.EMAIL_TRANSPORT || !!process.env.SMTP_HOST;
  return envConfigured ? "env" : "none";
}
