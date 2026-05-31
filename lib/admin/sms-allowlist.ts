"use server";

/**
 * Phase 11.4.4  admin SMS / WhatsApp allowlist actions.
 *
 * Per D5 (cost control): no seeker receives a real provider dispatch
 * until an admin has added a row for them here. This is the
 * single-throat-to-throttle that caps blast radius during the gated-
 * rollout phase.
 *
 * Two actions: `addSeekerToSmsAllowlist({ userId, note? })` +
 * `removeSeekerFromSmsAllowlist(userId)`.
 *
 * Audit-logged. Admin-only.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

const NOTE_MAX = 200;

export interface AddToAllowlistInput {
  userId: string;
  note?: string;
}

export async function addSeekerToSmsAllowlist(
  input: AddToAllowlistInput,
): Promise<ActionResult<{ id: string }>> {
  const admin = await verifyAdmin();
  const note = (input.note ?? "").trim();
  if (note.length > NOTE_MAX) {
    return {
      ok: false,
      message: `Note can't exceed ${NOTE_MAX} characters.`,
    };
  }

  const db = getDb();
  // Idempotent: re-adding returns the existing row id.
  const existing = await db
    .select({ id: schema.seekerSmsAllowlist.id })
    .from(schema.seekerSmsAllowlist)
    .where(eq(schema.seekerSmsAllowlist.userId, input.userId))
    .limit(1);
  if (existing[0]) return { ok: true, id: existing[0].id };

  const id = `alw_${randomUUID()}`;
  await db.insert(schema.seekerSmsAllowlist).values({
    id,
    userId: input.userId,
    enabledBy: admin.id,
    note: note.length > 0 ? note : null,
  });

  await logAccess({
    kind: "admin.sms_allowlist.added",
    actor: admin.id,
    subject: input.userId,
    meta: { rowId: id },
  });

  revalidatePath("/admin/sms-allowlist");
  return { ok: true, id };
}

export async function removeSeekerFromSmsAllowlist(
  userId: string,
): Promise<ActionResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  const existing = await db
    .select({ id: schema.seekerSmsAllowlist.id })
    .from(schema.seekerSmsAllowlist)
    .where(eq(schema.seekerSmsAllowlist.userId, userId))
    .limit(1);
  if (!existing[0]) return { ok: true };

  await db
    .delete(schema.seekerSmsAllowlist)
    .where(eq(schema.seekerSmsAllowlist.id, existing[0].id));

  await logAccess({
    kind: "admin.sms_allowlist.removed",
    actor: admin.id,
    subject: userId,
    meta: { rowId: existing[0].id },
  });

  revalidatePath("/admin/sms-allowlist");
  return { ok: true };
}
