"use server";

/**
 * Phase 18.1 ("Living Learning Catalog")  the seeker path-review feedback loop.
 *
 * A seeker who took a path tells others whether they'd recommend it (+ an
 * optional blocker note). One review per (seeker, path)  re-submitting updates.
 * Each write recomputes the path's `review_count` / `recommend_count` roll-up.
 *
 * Gated by `feature_flag_living_catalog` (the surface switch). Honesty: the
 * roll-up only renders above a k-anonymity floor (UI side); the blocker text is
 * never put in the audit meta (PII-flagged), only a `hasBlocker` boolean.
 */

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";

const BLOCKER_MAX = 280;

export type PathReviewResult =
  | { ok: true; reviewCount: number; recommendCount: number }
  | { ok: false; reason: "off" | "not_found" | "invalid" };

export async function submitPathReview(
  pathId: string,
  wouldRecommend: boolean,
  blocker?: string,
): Promise<PathReviewResult> {
  const enabled = await getSetting<boolean>("feature_flag_living_catalog");
  if (!enabled) return { ok: false, reason: "off" };

  await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) return { ok: false, reason: "invalid" };

  if (typeof pathId !== "string" || pathId.length === 0) {
    return { ok: false, reason: "invalid" };
  }
  const cleanBlocker = (blocker ?? "").trim().slice(0, BLOCKER_MAX) || null;

  const db = getDb();

  // Path must exist + be live.
  const path = await db
    .select({ id: schema.learningPaths.id })
    .from(schema.learningPaths)
    .where(
      and(
        eq(schema.learningPaths.id, pathId),
        sql`${schema.learningPaths.deletedAt} IS NULL`,
      ),
    )
    .limit(1);
  if (path.length === 0) return { ok: false, reason: "not_found" };

  // Upsert the seeker's review (one per seeker per path).
  await db
    .insert(schema.learningPathReviews)
    .values({
      id: `lpr_${randomUUID()}`,
      pathId,
      profileId: me.profileId,
      wouldRecommend,
      blocker: cleanBlocker,
    })
    .onConflictDoUpdate({
      target: [
        schema.learningPathReviews.pathId,
        schema.learningPathReviews.profileId,
      ],
      set: { wouldRecommend, blocker: cleanBlocker },
    });

  // Recompute the roll-up from the source rows (no drift).
  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      rec: sql<number>`count(*) filter (where ${schema.learningPathReviews.wouldRecommend})::int`,
    })
    .from(schema.learningPathReviews)
    .where(eq(schema.learningPathReviews.pathId, pathId));
  const reviewCount = agg?.total ?? 0;
  const recommendCount = agg?.rec ?? 0;

  await db
    .update(schema.learningPaths)
    .set({ reviewCount, recommendCount })
    .where(eq(schema.learningPaths.id, pathId));

  await logAccess({
    kind: "learning_path.reviewed",
    actor: me.profileId,
    subject: pathId,
    meta: { wouldRecommend, hasBlocker: cleanBlocker !== null },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true, reviewCount, recommendCount };
}
