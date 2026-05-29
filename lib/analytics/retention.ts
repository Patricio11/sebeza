/**
 * Phase 9.20 Tier 3 D8  retention snapshot read helper for /insights.
 *
 * The nightly `/api/cron/placement-retention-snapshot` cron writes one
 * row per (profession × province × milestone) cell on every run. This
 * helper loads the LATEST capture per cell  the most recent honest
 * retention figure we have  and shapes it for the /insights card.
 *
 * Suppression: the cron already filtered out cells below k = 10 hires.
 * Any cell that comes back from this helper is publishable.
 *
 * Aggregation flavours the read returns two views:
 *
 *   nationalByMilestone   one row per milestone aggregating every cell
 *                         in the country into a single retention rate.
 *                         The headline figure for the top of the card.
 *
 *   topCells              up to 12 cells with the best retention at
 *                         the 12-month mark, for the "Roles where hires
 *                         stick" callout.
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { PROFESSIONS, PROVINCES } from "@/lib/mock/taxonomy";

export interface NationalRetentionByMilestone {
  milestoneMonths: number;
  hiredInCohort: number;
  stillActiveAtMilestone: number;
  retentionRate: number;
}

export interface RetentionCell {
  professionSlug: string;
  professionLabel: string;
  provinceSlug: string;
  provinceLabel: string;
  milestoneMonths: number;
  hiredInCohort: number;
  stillActiveAtMilestone: number;
  retentionRate: number;
}

export interface RetentionSnapshot {
  /** ISO timestamp of the most recent capture (latest captured_at in DB). */
  capturedAt: string | null;
  /** Top-line numbers: total hired-in-cohort + retention rate per milestone. */
  nationalByMilestone: NationalRetentionByMilestone[];
  /** Best-retaining cells at the 12-month mark, sorted descending by rate.
   *  Capped at 12 cells; ties broken by larger cohort first (more reliable). */
  topCells: RetentionCell[];
  /** Number of (profession × province × milestone) cells that landed in
   *  the snapshot table for the latest capture. */
  cellsPublished: number;
}

/**
 * Latest published retention snapshot, ready for the /insights card.
 * Returns an empty shape (zeros, empty arrays) when no snapshot exists
 * yet  the cron may not have run or the cohort may be too thin to
 * publish any cell.
 */
export async function getLatestRetentionSnapshot(): Promise<RetentionSnapshot> {
  const db = getDb();

  // Find the latest capture timestamp; everything we surface comes
  // from that single capture so the numbers are internally consistent.
  const latest = await db
    .select({
      capturedAt: schema.placementRetentionSnapshots.capturedAt,
    })
    .from(schema.placementRetentionSnapshots)
    .orderBy(desc(schema.placementRetentionSnapshots.capturedAt))
    .limit(1);
  const capturedAt = latest[0]?.capturedAt ?? null;
  if (!capturedAt) {
    return {
      capturedAt: null,
      nationalByMilestone: [],
      topCells: [],
      cellsPublished: 0,
    };
  }

  // All cells in the latest capture. We use a tight window (same
  // capture timestamp) so we don't accidentally mix in a partial
  // earlier run.
  const cells = await db
    .select({
      professionSlug: schema.placementRetentionSnapshots.professionSlug,
      provinceSlug: schema.placementRetentionSnapshots.provinceSlug,
      milestoneMonths: schema.placementRetentionSnapshots.milestoneMonths,
      hiredInCohort: schema.placementRetentionSnapshots.hiredInCohort,
      stillActiveAtMilestone:
        schema.placementRetentionSnapshots.stillActiveAtMilestone,
    })
    .from(schema.placementRetentionSnapshots)
    .where(sql`${schema.placementRetentionSnapshots.capturedAt} = ${capturedAt}`);

  // National aggregate by milestone. We sum cohort + active across
  // every cell that made it past the k threshold. Cells suppressed
  // by the cron never reached this query.
  const nationalMap = new Map<
    number,
    { hiredInCohort: number; stillActiveAtMilestone: number }
  >();
  for (const c of cells) {
    const agg = nationalMap.get(c.milestoneMonths) ?? {
      hiredInCohort: 0,
      stillActiveAtMilestone: 0,
    };
    agg.hiredInCohort += c.hiredInCohort;
    agg.stillActiveAtMilestone += c.stillActiveAtMilestone;
    nationalMap.set(c.milestoneMonths, agg);
  }
  const nationalByMilestone: NationalRetentionByMilestone[] = Array.from(
    nationalMap.entries(),
  )
    .map(([milestoneMonths, agg]) => ({
      milestoneMonths,
      hiredInCohort: agg.hiredInCohort,
      stillActiveAtMilestone: agg.stillActiveAtMilestone,
      retentionRate:
        agg.hiredInCohort === 0
          ? 0
          : agg.stillActiveAtMilestone / agg.hiredInCohort,
    }))
    .sort((a, b) => a.milestoneMonths - b.milestoneMonths);

  // 12-month leaderboard. The 12-month milestone is the "did the hire
  // stick" headline figure  the 3 and 6-month rates rarely tell the
  // employer-of-choice story on their own.
  const professionLookup = new Map(PROFESSIONS.map((p) => [p.slug, p.label]));
  const provinceLookup = new Map(PROVINCES.map((p) => [p.slug, p.label]));
  const topCells: RetentionCell[] = cells
    .filter((c) => c.milestoneMonths === 12)
    .map((c) => ({
      professionSlug: c.professionSlug,
      professionLabel:
        professionLookup.get(c.professionSlug) ?? c.professionSlug,
      provinceSlug: c.provinceSlug,
      provinceLabel: provinceLookup.get(c.provinceSlug) ?? c.provinceSlug,
      milestoneMonths: 12,
      hiredInCohort: c.hiredInCohort,
      stillActiveAtMilestone: c.stillActiveAtMilestone,
      retentionRate:
        c.hiredInCohort === 0
          ? 0
          : c.stillActiveAtMilestone / c.hiredInCohort,
    }))
    .sort((a, b) => {
      if (b.retentionRate !== a.retentionRate) {
        return b.retentionRate - a.retentionRate;
      }
      // Tie-break: larger cohort = more reliable.
      return b.hiredInCohort - a.hiredInCohort;
    })
    .slice(0, 12);

  return {
    capturedAt:
      capturedAt instanceof Date
        ? capturedAt.toISOString()
        : new Date(capturedAt).toISOString(),
    nationalByMilestone,
    topCells,
    cellsPublished: cells.length,
  };
}
