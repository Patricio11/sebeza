"use server";

/**
 * Admin-managed org onboarding document requirements (2026-08, founder
 * decision per the SRS blueprint: the required-document list is
 * configured, never hardcoded  "different jurisdictions, different
 * document sets; hardcoding traps you").
 *
 * Soft-delete only (`active=false`): in-flight orgs keep their uploads
 * attached to retired requirements, and history stays reviewable.
 *
 * Every export here is a PUBLIC HTTP endpoint (Phase 32): verifyAdmin()
 * is the first await in each, and every write is audit-logged under
 * `org.requirements.update`.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

const ok = <T extends object>(extra?: T): { ok: true } & T =>
  ({ ok: true, ...(extra ?? ({} as T)) });
const fail = (message: string): { ok: false; message: string } => ({
  ok: false,
  message,
});

export interface AdminRequirementRow {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
  active: boolean;
}

export async function listDocumentRequirementsAdmin(): Promise<
  AdminRequirementRow[]
> {
  await verifyAdmin();
  const db = getDb();
  return db
    .select({
      id: schema.orgDocumentRequirements.id,
      name: schema.orgDocumentRequirements.name,
      description: schema.orgDocumentRequirements.description,
      required: schema.orgDocumentRequirements.required,
      sortOrder: schema.orgDocumentRequirements.sortOrder,
      active: schema.orgDocumentRequirements.active,
    })
    .from(schema.orgDocumentRequirements)
    .orderBy(asc(schema.orgDocumentRequirements.sortOrder));
}

const saveSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, "Name the document (3+ chars).").max(120),
  description: z.string().trim().max(300).optional(),
  required: z.boolean(),
});

export async function saveDocumentRequirement(
  input: z.infer<typeof saveSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, name, required } = parsed.data;
  const description = parsed.data.description || null;
  const db = getDb();

  if (id) {
    const rows = await db
      .select({ id: schema.orgDocumentRequirements.id })
      .from(schema.orgDocumentRequirements)
      .where(eq(schema.orgDocumentRequirements.id, id))
      .limit(1);
    if (!rows[0]) return fail("Requirement not found.");
    await db
      .update(schema.orgDocumentRequirements)
      .set({ name, description, required, updatedAt: new Date() })
      .where(eq(schema.orgDocumentRequirements.id, id));
    await logAccess({
      kind: "org.requirements.update",
      actor: session.id,
      subject: id,
      meta: { op: "edit", name, required },
    });
  } else {
    const newId = `req_${randomUUID()}`;
    const max = await db
      .select({ m: sql<number>`COALESCE(MAX(${schema.orgDocumentRequirements.sortOrder}), -1)::int` })
      .from(schema.orgDocumentRequirements);
    await db.insert(schema.orgDocumentRequirements).values({
      id: newId,
      name,
      description,
      required,
      sortOrder: (max[0]?.m ?? -1) + 1,
    });
    await logAccess({
      kind: "org.requirements.update",
      actor: session.id,
      subject: newId,
      meta: { op: "create", name, required },
    });
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/employer/onboarding");
  return ok();
}

const toggleSchema = z.object({ id: z.string().min(1), active: z.boolean() });

export async function toggleDocumentRequirement(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  if (!parsed.data.active) {
    // Never allow retiring the LAST active required requirement: an empty
    // checklist would let any org submit with zero documents.
    const activeRequired = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(schema.orgDocumentRequirements)
      .where(
        sql`${schema.orgDocumentRequirements.active} = true AND ${schema.orgDocumentRequirements.required} = true AND ${schema.orgDocumentRequirements.id} <> ${parsed.data.id}`,
      );
    if ((activeRequired[0]?.c ?? 0) === 0) {
      return fail(
        "At least one active required document must remain, or orgs could submit with nothing.",
      );
    }
  }

  await db
    .update(schema.orgDocumentRequirements)
    .set({ active: parsed.data.active, updatedAt: new Date() })
    .where(eq(schema.orgDocumentRequirements.id, parsed.data.id));
  await logAccess({
    kind: "org.requirements.update",
    actor: session.id,
    subject: parsed.data.id,
    meta: { op: parsed.data.active ? "restore" : "retire" },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/employer/onboarding");
  return ok();
}

const moveSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export async function moveDocumentRequirement(
  input: z.infer<typeof moveSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.orgDocumentRequirements.id,
      sortOrder: schema.orgDocumentRequirements.sortOrder,
    })
    .from(schema.orgDocumentRequirements)
    .orderBy(asc(schema.orgDocumentRequirements.sortOrder));
  const idx = rows.findIndex((r) => r.id === parsed.data.id);
  if (idx === -1) return fail("Requirement not found.");
  const swapWith = parsed.data.direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rows.length) return ok(); // already at edge

  const a = rows[idx]!;
  const b = rows[swapWith]!;
  await db
    .update(schema.orgDocumentRequirements)
    .set({ sortOrder: b.sortOrder, updatedAt: new Date() })
    .where(eq(schema.orgDocumentRequirements.id, a.id));
  await db
    .update(schema.orgDocumentRequirements)
    .set({ sortOrder: a.sortOrder, updatedAt: new Date() })
    .where(eq(schema.orgDocumentRequirements.id, b.id));
  await logAccess({
    kind: "org.requirements.update",
    actor: session.id,
    subject: a.id,
    meta: { op: "reorder", direction: parsed.data.direction },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/employer/onboarding");
  return ok();
}
