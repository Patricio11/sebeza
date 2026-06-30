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
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
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

// ── Phase 18.2: editorial / freshness admin ──────────────────────────────────

/** A path is "stale" (needs re-verification) when it's live but hasn't been
 *  re-verified in over this many days (or never has). */
export const FRESHNESS_STALE_DAYS = 90;

export interface AdminLearningPathRow {
  row: LearningPathRow;
  stale: boolean;
}

/** Every path (incl. soft-deleted), in display order, each tagged stale-or-not.
 *  For the `/admin/learning-paths` editorial surface. */
export async function listLearningPathsAdmin(): Promise<AdminLearningPathRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.learningPaths)
    .orderBy(asc(schema.learningPaths.sortOrder), asc(schema.learningPaths.id));
  const cutoff = Date.now() - FRESHNESS_STALE_DAYS * 86_400_000;
  return rows.map((row) => ({
    row,
    stale:
      row.deletedAt == null &&
      (row.lastVerifiedAt == null || row.lastVerifiedAt.getTime() < cutoff),
  }));
}

/** Count of live paths overdue for re-verification (drives the cron heartbeat). */
export async function countStaleLearningPaths(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - FRESHNESS_STALE_DAYS * 86_400_000);
  const [agg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.learningPaths)
    .where(
      and(
        isNull(schema.learningPaths.deletedAt),
        or(
          isNull(schema.learningPaths.lastVerifiedAt),
          lt(schema.learningPaths.lastVerifiedAt, cutoff),
        ),
      ),
    );
  return agg?.n ?? 0;
}
