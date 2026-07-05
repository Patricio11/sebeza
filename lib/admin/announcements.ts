"use server";

/**
 * Phase 25.4 ("Bulk announcements")  admin SMS announcements, POPIA-gated.
 *
 * A send fans out ONLY to users where ALL of these hold:
 *   1. `announcements` consent granted (opt-in, default-off, non-degrading),
 *   2. a VERIFIED phone number on file (phone_verified_at + phone_e164_enc),
 *   3. the SMS integration is enabled (admin-managed or env).
 *
 * Hard cap per send (spend control), per-send audit with the recipient COUNT
 * only  never the recipient list. Decrypted numbers exist only in-memory
 * during the fan-out.
 */

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { sendSms } from "@/lib/messaging/sms";
import { integrationSource } from "@/lib/integrations/resolve";

const MESSAGE_MAX = 300; // ~2 SMS segments
const FANOUT_CAP = 500; // hard spend/abuse ceiling per send

export type AnnouncementResult =
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: string };

/** How many users are currently eligible (consent + verified phone). */
export async function estimateAnnouncementRecipients(): Promise<number> {
  await verifyAdmin();
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.appUser)
    .innerJoin(
      schema.consents,
      and(
        eq(schema.consents.userId, schema.appUser.id),
        eq(schema.consents.purpose, "announcements"),
        eq(schema.consents.state, "granted"),
      ),
    )
    .where(
      and(
        isNotNull(schema.appUser.phoneE164Enc),
        isNotNull(schema.appUser.phoneVerifiedAt),
        sql`${schema.appUser.suspendedAt} IS NULL`,
        sql`${schema.appUser.deletedAt} IS NULL`,
      ),
    );
  return row?.n ?? 0;
}

const sendSchema = z.object({
  message: z.string().trim().min(10).max(MESSAGE_MAX),
});

export async function sendAnnouncement(
  rawMessage: string,
): Promise<AnnouncementResult> {
  const admin = await verifyAdmin();
  const parsed = sendSchema.safeParse({ message: rawMessage });
  if (!parsed.success) {
    return { ok: false, error: `Message must be 10–${MESSAGE_MAX} characters.` };
  }
  const message = parsed.data.message;

  // The SMS channel must actually be live (admin integration or env).
  const source = await integrationSource("sms");
  if (source === "none") {
    return { ok: false, error: "Configure + enable the SMS integration first." };
  }

  const db = getDb();
  const recipients = await db
    .select({
      userId: schema.appUser.id,
      phoneEnc: schema.appUser.phoneE164Enc,
    })
    .from(schema.appUser)
    .innerJoin(
      schema.consents,
      and(
        eq(schema.consents.userId, schema.appUser.id),
        eq(schema.consents.purpose, "announcements"),
        eq(schema.consents.state, "granted"),
      ),
    )
    .where(
      and(
        isNotNull(schema.appUser.phoneE164Enc),
        isNotNull(schema.appUser.phoneVerifiedAt),
        sql`${schema.appUser.suspendedAt} IS NULL`,
        sql`${schema.appUser.deletedAt} IS NULL`,
      ),
    )
    .limit(FANOUT_CAP);

  if (recipients.length === 0) {
    return { ok: false, error: "No eligible recipients (consent + verified phone)." };
  }

  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    try {
      const to = decryptField(r.phoneEnc!);
      const res = await sendSms({ to, body: message, tag: "announcement" });
      if (res.transport === "disabled") skipped++;
      else sent++;
    } catch {
      skipped++;
    }
  }

  await logAccess({
    kind: "admin.announcement.send",
    actor: admin.id,
    subject: "sms",
    meta: {
      recipientCount: sent,
      skipped,
      capped: recipients.length >= FANOUT_CAP,
      messageLength: message.length,
    },
  });

  return { ok: true, sent, skipped };
}
