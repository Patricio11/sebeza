"use server";

/**
 * Phase 11.4.4  phone-verification + channel-preference actions.
 *
 * Flow:
 *   1. Seeker enters E.164 phone on /dashboard/account.
 *   2. `requestPhoneVerificationCode(phone)` writes the encrypted
 *      phone + dispatches a 6-digit code via the SMS transport.
 *      Even when the platform flag is OFF, the code dispatches via
 *      the `console` transport for dev; in production the admin
 *      must flip the flag before the SMS-out path actually runs.
 *   3. Seeker enters the code -> `confirmPhoneVerification(code)`
 *      flips `phone_verified_at` + clears the pending code.
 *   4. Seeker toggles SMS / WhatsApp channel on/off via
 *      `setMessagingChannel(channel, on)`.
 *
 * Code storage: 6-digit numeric in-memory map keyed by userId. We
 * deliberately don't persist verification codes to the DB  the
 * code is single-use, short-TTL, and persistence would create a
 * tempting attack surface. Out-of-process scaling (multi-instance
 * Vercel) will need to swap this to Redis / Upstash; Phase 12+.
 */

import { eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";
import { encryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { sendSms } from "./sms";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

interface PendingCode {
  code: string;
  phoneEnc: string;
  expiresAt: number;
}

const PENDING = new Map<string, PendingCode>();
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const E164 = /^\+?[1-9]\d{6,14}$/;

function normalisePhone(input: string): string | null {
  const trimmed = input.replace(/\s+/g, "");
  if (!E164.test(trimmed)) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

export async function requestPhoneVerificationCode(
  phoneRaw: string,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const phone = normalisePhone(phoneRaw);
  if (!phone) {
    return {
      ok: false,
      message: "Phone must be in E.164 format (e.g. +27821234567).",
    };
  }
  const code = String(randomInt(100000, 999999));
  const phoneEnc = encryptField(phone);
  PENDING.set(session.id, {
    code,
    phoneEnc,
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  try {
    await sendSms({
      to: phone,
      body: `Your Sebenza verification code is ${code}. Expires in 10 minutes. If you didn't request this, ignore this SMS.`,
      tag: "phone.verify",
    });
  } catch (e) {
    // Don't expose provider errors verbatim. Audit logs the detail.
    await logAccess({
      kind: "phone.verification.sent",
      actor: session.id,
      subject: session.id,
      meta: { ok: false, error: e instanceof Error ? e.message : "send_failed" },
    });
    return {
      ok: false,
      message:
        "Couldn't send the verification SMS. Try again in a few minutes  if the issue persists, contact support.",
    };
  }

  await logAccess({
    kind: "phone.verification.sent",
    actor: session.id,
    subject: session.id,
    meta: { ok: true },
  });
  return { ok: true };
}

export async function confirmPhoneVerification(
  code: string,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const pending = PENDING.get(session.id);
  if (!pending) {
    return {
      ok: false,
      message: "No verification in progress. Request a new code.",
    };
  }
  if (Date.now() > pending.expiresAt) {
    PENDING.delete(session.id);
    return { ok: false, message: "Code expired. Request a new one." };
  }
  if (code.trim() !== pending.code) {
    return { ok: false, message: "Code doesn't match. Try again." };
  }

  const db = getDb();
  await db
    .update(schema.appUser)
    .set({
      phoneE164Enc: pending.phoneEnc,
      phoneVerifiedAt: new Date(),
    })
    .where(eq(schema.appUser.id, session.id));
  PENDING.delete(session.id);

  await logAccess({
    kind: "phone.verification.confirmed",
    actor: session.id,
    subject: session.id,
    meta: {},
  });
  revalidatePath("/dashboard/account");
  return { ok: true };
}

export async function clearPhoneVerification(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const db = getDb();
  await db
    .update(schema.appUser)
    .set({
      phoneE164Enc: null,
      phoneVerifiedAt: null,
      smsChannelEnabled: false,
      whatsappChannelEnabled: false,
    })
    .where(eq(schema.appUser.id, session.id));
  PENDING.delete(session.id);
  await logAccess({
    kind: "phone.verification.cleared",
    actor: session.id,
    subject: session.id,
    meta: {},
  });
  revalidatePath("/dashboard/account");
  return { ok: true };
}

export async function setMessagingChannel(
  channel: "sms" | "whatsapp",
  enabled: boolean,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const db = getDb();
  await db
    .update(schema.appUser)
    .set(
      channel === "sms"
        ? { smsChannelEnabled: enabled }
        : { whatsappChannelEnabled: enabled },
    )
    .where(eq(schema.appUser.id, session.id));
  revalidatePath("/dashboard/account");
  return { ok: true };
}
