/**
 * Phase 18 ("Living Learning Catalog")  the DB read path for learning paths.
 *
 * Replaces direct reads of the `MOCK_COMPASS.learningPaths` constant. Maps rows
 * back to the existing `LearningPath` shape so every downstream consumer (the
 * compass `pickRelevantPaths`, the abandon-modal free alternative, the learning
 * loop's path resolution) is unchanged in shape  only the *source* moves from
 * a constant to an admin-editable, seeker-rateable table. The seed mirrors the
 * constant exactly, so behaviour is preserved (a parity test asserts it).
 */

import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type {
  LearningCost,
  LearningPath,
  LearningProviderKind,
} from "@/lib/mock/growth";

export type LearningPathRow = typeof schema.learningPaths.$inferSelect;

/** Map a DB row back to the canonical `LearningPath` shape consumers expect. */
function toLearningPath(row: LearningPathRow): LearningPath {
  return {
    title: row.title,
    provider: row.provider,
    providerKind: row.providerKind as LearningProviderKind,
    durationWeeks: row.durationWeeks,
    cost: row.cost as LearningCost,
    costNote: row.costNote ?? undefined,
    outcome: row.outcome,
    unlocksSkills: row.unlocksSkills,
    national: row.national,
    url: row.url ?? undefined,
    sebenzaReviewed: row.sebenzaReviewed,
    id: row.id,
    reviewCount: row.reviewCount,
    recommendCount: row.recommendCount,
  };
}

/**
 * The full active catalog, in the constant's original display order
 * (`sort_order`). Soft-deleted paths are excluded. Order is deterministic so
 * `pickRelevantPaths` (a stable sort) yields the same render as the old constant.
 */
export async function listAllLearningPaths(): Promise<LearningPath[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.learningPaths)
    .where(isNull(schema.learningPaths.deletedAt))
    .orderBy(asc(schema.learningPaths.sortOrder), asc(schema.learningPaths.id));
  return rows.map(toLearningPath);
}

/** A single path row (for the editorial admin / review roll-up). */
export async function getLearningPath(
  id: string,
): Promise<LearningPathRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.learningPaths)
    .where(
      and(
        eq(schema.learningPaths.id, id),
        isNull(schema.learningPaths.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
