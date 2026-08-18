"use server";

/**
 * 2026-08  live-selfie verification actions
 * (docs/SELFIE_VERIFICATION_PLAN.md).
 *
 * The liveness check itself runs IN THE BROWSER (MediaPipe Face
 * Landmarker, self-hosted assets)  the server never receives or
 * processes face data for analysis. These actions only:
 *   1. mint a one-time random gesture challenge (so a pre-recorded
 *      capture can't be replayed), and
 *   2. accept the passing frame as the profile photo (existing WebP
 *      pipeline, metadata stripped) + stamp `selfieVerifiedAt`.
 *
 * Honest limit, by design: a modified client can fake the gesture
 * result. The badge therefore claims a live selfie, not identity.
 * Flag-gated: feature_flag_selfie_verification (default OFF).
 */

import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";
import { uploadPhoto, deleteStorageObject } from "@/lib/storage/upload";
import { StorageError } from "@/lib/storage/supabase";
import { recomputeProfileVerification } from "@/lib/profile/verification-rollup";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export type SelfieGesture = "turn-left" | "turn-right" | "blink" | "smile";
const GESTURES: SelfieGesture[] = ["turn-left", "turn-right", "blink", "smile"];

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGES_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

async function flagOn(): Promise<boolean> {
  return Boolean(await getSetting<boolean>("feature_flag_selfie_verification"));
}

/** Mint a one-time two-gesture challenge for the signed-in seeker. */
export async function startSelfieVerification(): Promise<
  ActionResult<{ challengeId: string; gestures: SelfieGesture[] }>
> {
  const me = await verifyRole("seeker");
  if (!(await flagOn())) {
    return { ok: false, message: "Selfie verification isn't available yet." };
  }
  const db = getDb();

  // Sweep this user's stale rows, then rate-limit mints.
  await db
    .delete(schema.selfieChallenges)
    .where(
      and(
        eq(schema.selfieChallenges.userId, me.id),
        sql`${schema.selfieChallenges.expiresAt} < now()`,
      ),
    );
  const [recent] = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(schema.selfieChallenges)
    .where(
      and(
        eq(schema.selfieChallenges.userId, me.id),
        gt(
          schema.selfieChallenges.createdAt,
          new Date(Date.now() - WINDOW_MS),
        ),
      ),
    );
  if ((recent?.c ?? 0) >= MAX_CHALLENGES_PER_WINDOW) {
    return {
      ok: false,
      message: "Too many attempts. Please try again in a few minutes.",
    };
  }

  // Two distinct gestures, order matters.
  const pool = [...GESTURES];
  const gestures: SelfieGesture[] = [];
  while (gestures.length < 2) {
    const idx = Math.floor(Math.random() * pool.length);
    gestures.push(...pool.splice(idx, 1));
  }

  const challengeId = `sc_${randomUUID()}`;
  await db.insert(schema.selfieChallenges).values({
    id: challengeId,
    userId: me.id,
    gestures,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });

  return { ok: true, challengeId, gestures };
}

/**
 * Accept the passing frame: becomes the profile photo (WebP pipeline)
 * and stamps `selfieVerifiedAt`, which grants `verified` in the 9.14
 * roll-up. The challenge must be the caller's, unused, and unexpired.
 */
export async function completeSelfieVerification(
  form: FormData,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  if (!(await flagOn())) {
    return { ok: false, message: "Selfie verification isn't available yet." };
  }

  const challengeId = form.get("challengeId");
  const file = form.get("file");
  if (typeof challengeId !== "string" || !(file instanceof File)) {
    return { ok: false, message: "Missing capture. Please try again." };
  }

  const db = getDb();
  const claimed = await db
    .update(schema.selfieChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.selfieChallenges.id, challengeId),
        eq(schema.selfieChallenges.userId, me.id),
        isNull(schema.selfieChallenges.usedAt),
        sql`${schema.selfieChallenges.expiresAt} >= now()`,
      ),
    )
    .returning({ id: schema.selfieChallenges.id });
  if (claimed.length === 0) {
    return {
      ok: false,
      message: "That verification attempt expired. Please start again.",
    };
  }

  const rows = await db
    .select({ id: schema.profiles.id, old: schema.profiles.profilePhotoUrl })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, me.id))
    .limit(1);
  const profile = rows[0];
  if (!profile) return { ok: false, message: "Profile not found." };

  let key: string;
  try {
    ({ key } = await uploadPhoto({ userId: me.id, id: "avatar", file }));
  } catch (e) {
    return {
      ok: false,
      message: e instanceof StorageError ? e.message : "Upload failed. Please try again.",
    };
  }

  await db
    .update(schema.profiles)
    .set({ profilePhotoUrl: key, selfieVerifiedAt: new Date() })
    .where(eq(schema.profiles.id, profile.id));
  if (profile.old && profile.old !== key) {
    try {
      await deleteStorageObject(profile.old);
    } catch {
      // Orphan sweep is the backstop.
    }
  }

  await recomputeProfileVerification(profile.id);

  await logAccess({
    kind: "profile.selfie.verified",
    actor: me.id,
    subject: profile.id,
    meta: { challengeId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
