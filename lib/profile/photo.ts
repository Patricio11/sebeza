"use server";

/**
 * Profile photo upload + remove.
 *
 * Photos live in the private Supabase bucket; reads use a short-lived signed
 * URL. `profiles.profile_photo_url` stores the storage object key (not a URL).
 * Helper `getSignedProfilePhotoUrl(key)` mints the URL at render time.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { uploadPhoto, deleteStorageObject } from "@/lib/storage/upload";
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

export async function uploadProfilePhoto(
  formData: FormData,
): Promise<ActionResult<{ key: string }>> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Missing photo file.");

  const db = getDb();
  const rows = await db
    .select({ id: schema.profiles.id, old: schema.profiles.profilePhotoUrl })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = rows[0];
  if (!profile) return fail("Profile not found.");

  try {
    const { key } = await uploadPhoto({
      userId: session.id,
      id: "avatar",
      file,
    });

    await db
      .update(schema.profiles)
      .set({ profilePhotoUrl: key })
      .where(eq(schema.profiles.id, profile.id));

    // Replace old object (different ext could leave it behind).
    if (profile.old && profile.old !== key) {
      try {
        await deleteStorageObject(profile.old);
      } catch {
        // Phase 8 cron sweeps orphans.
      }
    }

    await logAccess({
      kind: "profile.photo.upload",
      actor: session.id,
      subject: profile.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");
    return ok({ key });
  } catch (e) {
    if (e instanceof StorageError) return fail(e.message);
    return fail("Upload failed. Please try again.");
  }
}

export async function removeProfilePhoto(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");

  const db = getDb();
  const rows = await db
    .select({ id: schema.profiles.id, key: schema.profiles.profilePhotoUrl })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = rows[0];
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({ profilePhotoUrl: null })
    .where(eq(schema.profiles.id, profile.id));

  if (profile.key) {
    try {
      await deleteStorageObject(profile.key);
    } catch {
      // Not fatal — Phase 8 cron sweeps orphans.
    }
  }

  await logAccess({
    kind: "profile.photo.remove",
    actor: session.id,
    subject: profile.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return ok();
}
