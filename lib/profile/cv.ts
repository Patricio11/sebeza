"use server";

/**
 * Phase 11.5.2  personal CV backup actions.
 *
 * Four actions: uploadCv, downloadCv (returns signed URL),
 * replaceCv, deleteCv. Each writes an audit row.
 *
 * D3 invariant: CV is private to the seeker. Never returned in any
 * public projection, never indexed for search, never exposed to
 * employer-facing surfaces. The storage object lives under
 * `{userId}/cvs/{id}.pdf` in the existing private bucket; admin
 * access only via the POPIA data-export flow.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { uploadCv as uploadCvObject } from "@/lib/storage/upload";
import { deleteStorageObject } from "@/lib/storage/upload";
import { signedDocumentUrl } from "@/lib/storage/signed";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

const FILENAME_MAX = 200;

function sanitiseFilename(raw: string): string {
  const trimmed = raw.trim().slice(0, FILENAME_MAX);
  return trimmed.length > 0 ? trimmed : "cv.pdf";
}

async function getMyProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.profiles.id,
      cvStorageKey: schema.profiles.cvStorageKey,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function uploadCv(form: FormData): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profile = await getMyProfile(me.id);
  if (!profile) return { ok: false, message: "Profile not found." };

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Pick a PDF file to upload." };
  }
  const filename = sanitiseFilename(
    (form.get("filename") as string | null) ?? file.name ?? "cv.pdf",
  );

  const id = `cv_${randomUUID()}`;
  let key: string;
  try {
    const result = await uploadCvObject({ userId: me.id, id, file });
    key = result.key;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Upload failed.",
    };
  }

  // If a CV was already on file, clean up the old object. Best-effort
  // we never block the new upload on the delete; storage cleanup is
  // eventually-consistent.
  if (profile.cvStorageKey && profile.cvStorageKey !== key) {
    try {
      await deleteStorageObject(profile.cvStorageKey);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[cv] previous-object cleanup failed:", e);
    }
  }

  const db = getDb();
  await db
    .update(schema.profiles)
    .set({
      cvStorageKey: key,
      cvUploadedAt: new Date(),
      cvFilename: filename,
    })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: me.id,
    subject: profile.id,
    meta: { fields: ["cvStorageKey"], filename, action: "cv_upload" },
  });

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * Return a short-lived signed URL the seeker's browser can fetch
 * directly. Audit the access so we have a record of when the seeker
 * looked at their own backup.
 */
export async function downloadCv(): Promise<
  ActionResult<{ url: string; filename: string }>
> {
  const me = await verifyRole("seeker");
  const profile = await getMyProfile(me.id);
  if (!profile || !profile.cvStorageKey) {
    return { ok: false, message: "No CV on file." };
  }

  const url = await signedDocumentUrl(profile.cvStorageKey);
  if (!url) {
    return { ok: false, message: "Couldn't generate a download link." };
  }

  // Fetch the filename so the caller can suggest it to the browser.
  const db = getDb();
  const rows = await db
    .select({ filename: schema.profiles.cvFilename })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profile.id))
    .limit(1);
  const filename = rows[0]?.filename ?? "cv.pdf";

  await logAccess({
    kind: "profile.update",
    actor: me.id,
    subject: profile.id,
    meta: { action: "cv_download" },
  });

  return { ok: true, url, filename };
}

export async function deleteCv(): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profile = await getMyProfile(me.id);
  if (!profile) return { ok: false, message: "Profile not found." };
  if (!profile.cvStorageKey) return { ok: true };

  try {
    await deleteStorageObject(profile.cvStorageKey);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cv] delete object failed:", e);
  }

  const db = getDb();
  await db
    .update(schema.profiles)
    .set({
      cvStorageKey: null,
      cvUploadedAt: null,
      cvFilename: null,
    })
    .where(eq(schema.profiles.id, profile.id));

  await logAccess({
    kind: "profile.update",
    actor: me.id,
    subject: profile.id,
    meta: { fields: ["cvStorageKey"], action: "cv_delete" },
  });

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
