"use server";

/**
 * Phase 22.2  admin management of crisis-support resources. Admin-gated, Zod-
 * validated, audited. These are the VERIFIED helpline details shown in the
 * coach's distress pathway; an admin owns keeping them current (a wrong number
 * is a safety failure). Revalidates the coach surface so changes go live.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type CrisisResourceResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const resourceInput = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(2).max(200),
  availability: z.string().trim().max(60).optional().or(z.literal("")),
  note: z.string().trim().max(200).optional().or(z.literal("")),
  active: z.coerce.boolean().default(false),
});

export type CrisisResourceInput = z.input<typeof resourceInput>;

function revalidate() {
  revalidatePath("/admin/crisis-resources");
  revalidatePath("/dashboard/coach");
}

export async function addCrisisResource(
  input: CrisisResourceInput,
): Promise<CrisisResourceResult> {
  const admin = await verifyAdmin();
  const parsed = resourceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid resource." };
  const v = parsed.data;

  const db = getDb();
  const existing = await db.select({ id: schema.crisisResources.id }).from(schema.crisisResources);
  const id = `cr_${randomUUID()}`;
  await db.insert(schema.crisisResources).values({
    id,
    name: v.name,
    contact: v.contact,
    availability: v.availability ? v.availability : null,
    note: v.note ? v.note : null,
    active: v.active,
    sortOrder: existing.length,
  });

  await logAccess({
    kind: "admin.crisis_resource.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "create", active: v.active },
  });
  revalidate();
  return { ok: true, id };
}

export async function updateCrisisResource(
  id: string,
  input: CrisisResourceInput,
): Promise<CrisisResourceResult> {
  const admin = await verifyAdmin();
  const parsed = resourceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid resource." };
  const v = parsed.data;

  const db = getDb();
  await db
    .update(schema.crisisResources)
    .set({
      name: v.name,
      contact: v.contact,
      availability: v.availability ? v.availability : null,
      note: v.note ? v.note : null,
      active: v.active,
    })
    .where(eq(schema.crisisResources.id, id));

  await logAccess({
    kind: "admin.crisis_resource.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "update", active: v.active },
  });
  revalidate();
  return { ok: true, id };
}

export async function removeCrisisResource(
  id: string,
): Promise<CrisisResourceResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  await db.delete(schema.crisisResources).where(eq(schema.crisisResources.id, id));

  await logAccess({
    kind: "admin.crisis_resource.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "delete" },
  });
  revalidate();
  return { ok: true, id };
}
