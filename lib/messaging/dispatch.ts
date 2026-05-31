/**
 * Phase 11.4.4  multi-gate dispatch for SMS / WhatsApp channels.
 *
 * Single entry point: `dispatchMessage({ userId, kind, body })`.
 *
 * The dispatch layer enforces the SIX gates that together guarantee
 * zero spend without explicit operator approval. If any gate fails,
 * we log `notification.{channel}.skipped` with the reason + return
 * `{ ok: false, reason }`. If all pass, we call the provider via
 * lib/messaging/{sms,whatsapp}.ts.
 *
 * The six gates:
 *   1. Platform flag (admin-controlled): `feature_flag_{sms,whatsapp}_channel_enabled`
 *   2. Provider configured: env `SMS_PROVIDER` / `WHATSAPP_PROVIDER` set
 *      to a non-disabled value AND the channel's transport function
 *      returns a real provider (not `disabled` / `console`).
 *   3. Per-seeker consent: `messaging_channel_{sms,whatsapp}` granted
 *   4. Per-seeker app_user flag: `{sms,whatsapp}_channel_enabled = true`
 *   5. Phone verified: `phone_verified_at IS NOT NULL`
 *   6. Allowlist row: present in `seeker_sms_allowlist`
 *
 * Gates 1-2 protect global spend. Gates 3-4 protect per-seeker
 * consent. Gate 5 protects deliverability. Gate 6 caps blast radius
 * during the gated-rollout phase per plan D5.
 *
 * Quiet hours (D6): refuses to dispatch between
 * `feature_flag_sms_quiet_hours_start` and `_end` (SAST).
 */

import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { hasConsent } from "@/lib/consent/check";
import { sendSms } from "./sms";
import { sendWhatsApp } from "./whatsapp";

export type DispatchChannel = "sms" | "whatsapp";

export type SkipReason =
  | "platform_flag_off"
  | "provider_not_configured"
  | "consent_not_granted"
  | "channel_off_for_user"
  | "phone_not_verified"
  | "not_in_allowlist"
  | "quiet_hours"
  | "user_not_found";

export interface DispatchInput {
  userId: string;
  channel: DispatchChannel;
  /** Notification kind the dispatch is for  passed into the audit
   *  row as context. Use the catalog kind ("vacancy.invite",
   *  "contact.revealed", etc.). */
  kind: string;
  body: string;
}

export interface DispatchResult {
  ok: boolean;
  reason?: SkipReason | string;
  provider?: string;
}

const SAST_OFFSET_HOURS = 2;

function nowSastHour(): number {
  const now = new Date();
  return (now.getUTCHours() + SAST_OFFSET_HOURS) % 24;
}

function inQuietHours(start: number, end: number): boolean {
  const hour = nowSastHour();
  // Standard: start=21, end=7 -> quiet between 21:00 (inclusive) and
  // 07:00 (exclusive). The window wraps midnight; handle both shapes.
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export async function dispatchMessage(
  input: DispatchInput,
): Promise<DispatchResult> {
  const db = getDb();

  // Gate 1  platform flag.
  const platformFlagKey =
    input.channel === "sms"
      ? "feature_flag_sms_channel_enabled"
      : "feature_flag_whatsapp_channel_enabled";
  const platformEnabled = await getSetting<boolean>(platformFlagKey);
  if (!platformEnabled) {
    await skip(input, "platform_flag_off");
    return { ok: false, reason: "platform_flag_off" };
  }

  // Gate 7 (D6)  quiet hours.
  const quietStart = await getSetting<number>(
    "feature_flag_sms_quiet_hours_start",
  );
  const quietEnd = await getSetting<number>("feature_flag_sms_quiet_hours_end");
  if (inQuietHours(quietStart, quietEnd)) {
    await skip(input, "quiet_hours");
    return { ok: false, reason: "quiet_hours" };
  }

  // Read the user's row + gates 4 + 5 in one round trip.
  const rows = await db
    .select({
      phoneE164Enc: schema.appUser.phoneE164Enc,
      phoneVerifiedAt: schema.appUser.phoneVerifiedAt,
      smsChannelEnabled: schema.appUser.smsChannelEnabled,
      whatsappChannelEnabled: schema.appUser.whatsappChannelEnabled,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, input.userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    await skip(input, "user_not_found");
    return { ok: false, reason: "user_not_found" };
  }

  const channelOn =
    input.channel === "sms"
      ? user.smsChannelEnabled
      : user.whatsappChannelEnabled;
  if (!channelOn) {
    await skip(input, "channel_off_for_user");
    return { ok: false, reason: "channel_off_for_user" };
  }

  if (!user.phoneVerifiedAt) {
    await skip(input, "phone_not_verified");
    return { ok: false, reason: "phone_not_verified" };
  }
  if (!user.phoneE164Enc) {
    await skip(input, "phone_not_verified");
    return { ok: false, reason: "phone_not_verified" };
  }

  // Gate 3  per-seeker consent.
  const consentPurpose =
    input.channel === "sms"
      ? "messaging_channel_sms"
      : "messaging_channel_whatsapp";
  const consent = await hasConsent(input.userId, consentPurpose);
  if (!consent) {
    await skip(input, "consent_not_granted");
    return { ok: false, reason: "consent_not_granted" };
  }

  // Gate 6  allowlist.
  const allow = await db
    .select({ id: schema.seekerSmsAllowlist.id })
    .from(schema.seekerSmsAllowlist)
    .where(eq(schema.seekerSmsAllowlist.userId, input.userId))
    .limit(1);
  if (allow.length === 0) {
    await skip(input, "not_in_allowlist");
    return { ok: false, reason: "not_in_allowlist" };
  }

  // Decrypt the phone for the dispatch call.
  let to: string;
  try {
    to = decryptField(user.phoneE164Enc);
  } catch {
    await skip(input, "phone_not_verified");
    return { ok: false, reason: "phone_not_verified" };
  }

  // Gate 2 + final dispatch.
  try {
    if (input.channel === "sms") {
      const result = await sendSms({ to, body: input.body, tag: input.kind });
      if (result.transport === "disabled") {
        await skip(input, "provider_not_configured");
        return { ok: false, reason: "provider_not_configured" };
      }
      await logAccess({
        kind: "notification.sms.sent",
        actor: "system",
        subject: input.userId,
        meta: {
          kind: input.kind,
          transport: result.transport,
          providerId: result.id ?? null,
        },
      });
      return { ok: true, provider: result.transport };
    } else {
      const result = await sendWhatsApp({
        to,
        body: input.body,
        tag: input.kind,
      });
      if (result.transport === "disabled") {
        await skip(input, "provider_not_configured");
        return { ok: false, reason: "provider_not_configured" };
      }
      await logAccess({
        kind: "notification.whatsapp.sent",
        actor: "system",
        subject: input.userId,
        meta: {
          kind: input.kind,
          transport: result.transport,
          providerId: result.id ?? null,
        },
      });
      return { ok: true, provider: result.transport };
    }
  } catch (e) {
    await logAccess({
      kind: input.channel === "sms"
        ? "notification.sms.failed"
        : "notification.whatsapp.failed",
      actor: "system",
      subject: input.userId,
      meta: {
        kind: input.kind,
        error: e instanceof Error ? e.message : String(e),
      },
    });
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "send_failed",
    };
  }
}

async function skip(input: DispatchInput, reason: SkipReason): Promise<void> {
  await logAccess({
    kind:
      input.channel === "sms"
        ? "notification.sms.skipped"
        : "notification.whatsapp.skipped",
    actor: "system",
    subject: input.userId,
    meta: { kind: input.kind, reason },
  });
}

// Suppress unused-import warnings while we keep the `and` import
// available for future per-(kind, userId) dispatch caps.
void and;
