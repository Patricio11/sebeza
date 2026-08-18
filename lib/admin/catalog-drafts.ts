"use server";

/**
 * 2026-08  admin actions for the AI-drafted catalogue pipeline
 * (COMPASS_FUEL_PLAN B). Draft → review (edit) → approve into
 * `learning_paths` / reject. Guard-first: every export verifies admin.
 */

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import {
  draftCatalogEntries,
  draftEntrySchema,
} from "@/lib/llm/catalog-drafts";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export interface CatalogDraftRow {
  id: string;
  skillSlugs: string[];
  payload: Record<string, unknown>;
  rawModel: string | null;
  createdAt: string;
}

export async function listCatalogDrafts(): Promise<CatalogDraftRow[]> {
  await verifyAdmin();
  const rows = await getDb()
    .select()
    .from(schema.catalogDrafts)
    .where(eq(schema.catalogDrafts.state, "pending"))
    .orderBy(asc(schema.catalogDrafts.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    skillSlugs: r.skillSlugs,
    payload: r.payload,
    rawModel: r.rawModel,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function requestCatalogDrafts(input: {
  skillSlugs: string[];
}): Promise<ActionResult<{ drafted: number }>> {
  const admin = await verifyAdmin();
  const parsed = z
    .object({ skillSlugs: z.array(z.string().min(1)).min(1).max(8) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick 1-8 skills." };

  const res = await draftCatalogEntries({
    skillSlugs: parsed.data.skillSlugs,
    callerUserId: admin.id,
    callerRole: admin.role,
  });
  if (!res.ok) return { ok: false, message: res.reason };
  revalidatePath("/admin/learning-paths");
  return { ok: true, drafted: res.drafted };
}

// The admin can edit every field before approval; the edited payload is
// validated with the SAME schema the LLM output passed through, plus an
// optional admin-supplied verified URL (the model is never allowed one).
const approveSchema = z.object({
  id: z.string().min(1),
  payload: draftEntrySchema.extend({
    url: z
      .string()
      .trim()
      .url()
      .max(300)
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
  }),
});

export async function approveCatalogDraft(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult> {
  const admin = await verifyAdmin();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the fields.",
    };
  }
  const db = getDb();

  const claimed = await db
    .update(schema.catalogDrafts)
    .set({
      state: "approved",
      resolvedByUserId: admin.id,
      resolvedAt: new Date(),
      payload: parsed.data.payload as Record<string, unknown>,
    })
    .where(
      and(
        eq(schema.catalogDrafts.id, parsed.data.id),
        eq(schema.catalogDrafts.state, "pending"),
      ),
    )
    .returning({ id: schema.catalogDrafts.id });
  if (claimed.length === 0) {
    return { ok: false, message: "Draft not found or already resolved." };
  }

  const p = parsed.data.payload;
  const pathId = `lp_${randomUUID()}`;
  await db.insert(schema.learningPaths).values({
    id: pathId,
    title: p.title,
    provider: p.provider,
    providerKind: p.providerKind,
    cost: p.cost,
    costNote: p.costNote ?? null,
    outcome: p.outcome,
    durationWeeks: p.durationWeeks,
    unlocksSkills: p.unlocksSkills,
    national: p.national,
    url: p.url ?? null,
    // Honest defaults: reviewed=false until the admin verifies the route
    // itself (link, dates) via the existing manager verification flow.
    sebenzaReviewed: false,
  });

  await logAccess({
    kind: "catalog.approve",
    actor: admin.id,
    subject: parsed.data.id,
    meta: { pathId, title: p.title },
  });
  revalidatePath("/admin/learning-paths");
  revalidatePath("/dashboard/grow");
  return { ok: true };
}

export async function rejectCatalogDraft(input: {
  id: string;
  note?: string;
}): Promise<ActionResult> {
  const admin = await verifyAdmin();
  if (!input?.id) return { ok: false, message: "Missing draft id." };
  const db = getDb();
  const claimed = await db
    .update(schema.catalogDrafts)
    .set({
      state: "rejected",
      resolvedByUserId: admin.id,
      resolvedAt: new Date(),
      adminNote: input.note?.slice(0, 300) ?? null,
    })
    .where(
      and(
        eq(schema.catalogDrafts.id, input.id),
        eq(schema.catalogDrafts.state, "pending"),
      ),
    )
    .returning({ id: schema.catalogDrafts.id });
  if (claimed.length === 0) {
    return { ok: false, message: "Draft not found or already resolved." };
  }
  await logAccess({
    kind: "catalog.reject",
    actor: admin.id,
    subject: input.id,
  });
  revalidatePath("/admin/learning-paths");
  return { ok: true };
}
