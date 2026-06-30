"use server";

/**
 * Phase 18.2 ("Living Learning Catalog")  admin editorial actions over the
 * `learning_paths` table: create, update, re-verify (the freshness heartbeat's
 * resolution), soft-delete + restore. Admin-gated, Zod-validated, audited
 * (`admin.learning_path.edit` with `meta.action`), and revalidating BOTH the
 * admin surface and `/dashboard/grow` (edits flow to the seeker catalog).
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type AdminPathResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const pathInput = z.object({
  title: z.string().trim().min(3).max(160),
  provider: z.string().trim().min(2).max(160),
  providerKind: z.string().trim().min(2).max(40),
  cost: z.enum(["free", "subsidised", "paid"]),
  costNote: z.string().trim().max(200).optional().or(z.literal("")),
  outcome: z.string().trim().min(3).max(400),
  durationWeeks: z.coerce.number().int().min(0).max(520),
  unlocksSkills: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  national: z.coerce.boolean().default(false),
  url: z.string().trim().url().max(500).optional().or(z.literal("")),
  sebenzaReviewed: z.coerce.boolean().default(false),
});

export type PathInput = z.input<typeof pathInput>;

function slugifyId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${randomUUID().slice(0, 6)}`;
}

function revalidate() {
  revalidatePath("/admin/learning-paths");
  revalidatePath("/dashboard/grow");
}

export async function createLearningPath(
  input: PathInput,
): Promise<AdminPathResult> {
  const admin = await verifyAdmin();
  const parsed = pathInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid path details." };
  const v = parsed.data;

  const db = getDb();
  // Append after the current max sort_order so it lands at the end.
  const existing = await db.select({ id: schema.learningPaths.id }).from(schema.learningPaths);
  const id = slugifyId(v.title);
  await db.insert(schema.learningPaths).values({
    id,
    title: v.title,
    provider: v.provider,
    providerKind: v.providerKind,
    cost: v.cost,
    costNote: v.costNote ? v.costNote : null,
    outcome: v.outcome,
    durationWeeks: v.durationWeeks,
    unlocksSkills: v.unlocksSkills,
    national: v.national,
    url: v.url ? v.url : null,
    sebenzaReviewed: v.sebenzaReviewed,
    lastVerifiedAt: new Date(),
    sortOrder: existing.length,
  });

  await logAccess({
    kind: "admin.learning_path.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "create", title: v.title },
  });
  revalidate();
  return { ok: true, id };
}

export async function updateLearningPath(
  id: string,
  input: PathInput,
): Promise<AdminPathResult> {
  const admin = await verifyAdmin();
  const parsed = pathInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid path details." };
  const v = parsed.data;

  const db = getDb();
  await db
    .update(schema.learningPaths)
    .set({
      title: v.title,
      provider: v.provider,
      providerKind: v.providerKind,
      cost: v.cost,
      costNote: v.costNote ? v.costNote : null,
      outcome: v.outcome,
      durationWeeks: v.durationWeeks,
      unlocksSkills: v.unlocksSkills,
      national: v.national,
      url: v.url ? v.url : null,
      sebenzaReviewed: v.sebenzaReviewed,
    })
    .where(eq(schema.learningPaths.id, id));

  await logAccess({
    kind: "admin.learning_path.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "update", title: v.title },
  });
  revalidate();
  return { ok: true, id };
}

/** The freshness-heartbeat resolution: re-verify (+ mark editorially reviewed). */
export async function markLearningPathVerified(
  id: string,
): Promise<AdminPathResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  await db
    .update(schema.learningPaths)
    .set({ lastVerifiedAt: new Date(), sebenzaReviewed: true })
    .where(eq(schema.learningPaths.id, id));

  await logAccess({
    kind: "admin.learning_path.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "verify" },
  });
  revalidate();
  return { ok: true, id };
}

export async function softDeleteLearningPath(
  id: string,
): Promise<AdminPathResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  await db
    .update(schema.learningPaths)
    .set({ deletedAt: new Date() })
    .where(eq(schema.learningPaths.id, id));

  await logAccess({
    kind: "admin.learning_path.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "delete" },
  });
  revalidate();
  return { ok: true, id };
}

export async function restoreLearningPath(
  id: string,
): Promise<AdminPathResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  await db
    .update(schema.learningPaths)
    .set({ deletedAt: null })
    .where(eq(schema.learningPaths.id, id));

  await logAccess({
    kind: "admin.learning_path.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "restore" },
  });
  revalidate();
  return { ok: true, id };
}
