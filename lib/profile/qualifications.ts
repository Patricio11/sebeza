"use server";

/**
 * Phase 3 — Qualification CRUD + document upload.
 *
 * Flow:
 *   1. `addQualification({ title, institution, awardedYear })` — creates a row
 *       in `unverified` state. No document yet.
 *   2. `uploadQualificationDocument({ qualificationId, file })` — uploads to
 *       Supabase Storage and writes the storage key onto the row.
 *   3. `deleteQualification(id)` — removes the DB row AND the storage object.
 *
 * Documents always live in the private bucket; reads happen via short-lived
 * signed URLs minted by `lib/storage/signed.ts`.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import {
  uploadDocument,
  deleteStorageObject,
} from "@/lib/storage/upload";
import { StorageError } from "@/lib/storage/supabase";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────

const addSchema = z.object({
  title: z.string().min(2).max(160),
  institution: z.string().min(2).max(160),
  awardedYear: z.number().int().min(1950).max(2100).nullable().optional(),
});

export async function addQualification(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the fields and try again.");
  const db = getDb();
  const profile = await ownedProfileId(db, session.id);
  if (!profile) return fail("Profile not found.");

  const id = `qual_${randomUUID()}`;
  await db.insert(schema.qualifications).values({
    id,
    profileId: profile,
    title: parsed.data.title,
    institution: parsed.data.institution,
    awardedYear: parsed.data.awardedYear ?? null,
    verification: "unverified",
    documentStorageKey: null,
  });

  await logAccess({
    kind: "profile.qualification.add",
    actor: session.id,
    subject: id,
  });

  revalidatePath("/dashboard/qualifications");
  return ok({ id });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function uploadQualificationDocument(
  formData: FormData,
): Promise<ActionResult<{ key: string }>> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");

  const qualificationId = String(formData.get("qualificationId") ?? "");
  const file = formData.get("file");
  if (!qualificationId) return fail("Missing qualification id.");
  if (!(file instanceof File)) return fail("Missing file.");

  const db = getDb();
  const profile = await ownedProfileId(db, session.id);
  if (!profile) return fail("Profile not found.");

  // Ownership check: the qualification row must belong to this profile.
  const rows = await db
    .select({
      id: schema.qualifications.id,
      old: schema.qualifications.documentStorageKey,
    })
    .from(schema.qualifications)
    .where(
      and(
        eq(schema.qualifications.id, qualificationId),
        eq(schema.qualifications.profileId, profile),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Qualification not found.");

  try {
    const { key } = await uploadDocument({
      userId: session.id,
      id: qualificationId,
      file,
    });

    await db
      .update(schema.qualifications)
      .set({ documentStorageKey: key, verification: "pending" })
      .where(eq(schema.qualifications.id, qualificationId));

    // Best-effort cleanup of the old object if the path changed (e.g. different ext).
    if (row.old && row.old !== key) {
      try {
        await deleteStorageObject(row.old);
      } catch {
        // Not fatal — Phase 8 cron sweeps orphans.
      }
    }

    await logAccess({
      kind: "profile.qualification.document.upload",
      actor: session.id,
      subject: qualificationId,
    });

    revalidatePath("/dashboard/qualifications");
    return ok({ key });
  } catch (e) {
    if (e instanceof StorageError) return fail(e.message);
    return fail("Upload failed. Please try again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function deleteQualification(id: string): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  if (!id) return fail("Missing qualification id.");
  const db = getDb();
  const profile = await ownedProfileId(db, session.id);
  if (!profile) return fail("Profile not found.");

  const rows = await db
    .select({
      id: schema.qualifications.id,
      key: schema.qualifications.documentStorageKey,
    })
    .from(schema.qualifications)
    .where(
      and(
        eq(schema.qualifications.id, id),
        eq(schema.qualifications.profileId, profile),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Qualification not found.");

  await db
    .delete(schema.qualifications)
    .where(eq(schema.qualifications.id, id));

  if (row.key) {
    try {
      await deleteStorageObject(row.key);
    } catch {
      // Not fatal — Phase 8 cron sweeps orphans.
    }
  }

  await logAccess({
    kind: "profile.qualification.delete",
    actor: session.id,
    subject: id,
  });

  revalidatePath("/dashboard/qualifications");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getDb>;

async function ownedProfileId(db: Db, userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}
