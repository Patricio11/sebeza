/**
 * Phase 9  Sebenza Labour Market Index (LMI).
 *
 * One number, 0..1 (we display it as 0.00  1.00, two decimals), that
 * summarises the health of the SA labour-market signal Sebenza
 * surfaces:
 *
 *     LMI = 0.4 × freshness_ratio
 *         + 0.4 × (1 - normalised_gap)
 *         + 0.2 × placement_velocity
 *
 * Components:
 *   - `freshness_ratio` = fresh profiles / total active profiles. Bounded [0,1].
 *   - `normalised_gap`  = mean(per-skill gap) / mean(per-skill supply),
 *                          capped at 1. Higher means more unfilled demand.
 *                          We subtract from 1 so that 1.0 = fully met demand.
 *   - `placement_velocity` = employer-confirmed placements this month /
 *                            active profile pool, normalised to [0,1] by
 *                            dividing by 0.10 (a 10%/month placement rate
 *                            is "saturated" for SA labour-market scale).
 *
 * All bounded; weights sum to 1.0; the headline number is honest about
 * what it can be. The formula is published on /insights so anyone
 * questioning it can see exactly what they're looking at.
 *
 * Not an official statistic; an opinionated index. Stats SA owns the
 * official numbers. We surface the LMI as "Sebenza Labour Market
 * Index" everywhere  never "South African" without the qualifier.
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { dataProvider } from "@/lib/data/provider";
import {
  skillsGapQuery,
  freshnessBreakdownQuery,
} from "@/db/queries/analytics";
import { getSetting } from "@/lib/admin/settings";

export interface LmiBreakdown {
  /** Composite index, 0..1. */
  value: number;
  /** Components  exposed for transparency. */
  components: {
    freshnessRatio: number;
    metDemand: number;
    placementVelocity: number;
  };
  /** Snapshotted at this ISO timestamp. */
  computedAt: string;
}

const W_FRESHNESS = 0.4;
const W_MET_DEMAND = 0.4;
const W_PLACEMENT = 0.2;
const SATURATION_PLACEMENT_RATE = 0.1; // 10%/month is "fully saturated"

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export async function computeLmi(): Promise<LmiBreakdown> {
  const [freshDays, ageingDays] = await Promise.all([
    getSetting<number>("freshness_band_days_fresh"),
    getSetting<number>("freshness_band_days_ageing"),
  ]);
  const [freshness, gap, snapshot] = await Promise.all([
    freshnessBreakdownQuery({ freshDays, ageingDays }),
    skillsGapQuery({ top: 50 }),
    dataProvider.getAnalyticsSnapshot(),
  ]);

  // freshness_ratio
  const freshnessRatio = freshness.total > 0 ? freshness.fresh / freshness.total : 0;

  // normalised gap (1 - unmet)
  const totalSupply = gap.reduce((s, g) => s + g.matches, 0);
  const totalGap = gap.reduce((s, g) => s + Math.max(0, g.gap), 0);
  const unmetRatio = totalSupply + totalGap > 0
    ? totalGap / (totalSupply + totalGap)
    : 0;
  const metDemand = clamp01(1 - unmetRatio);

  // placement velocity  confirmed hires this month / active pool
  const activePool = freshness.total || 1;
  const placementRate = snapshot.confirmedHiresThisMonth / activePool;
  const placementVelocity = clamp01(placementRate / SATURATION_PLACEMENT_RATE);

  const value = clamp01(
    W_FRESHNESS * freshnessRatio +
      W_MET_DEMAND * metDemand +
      W_PLACEMENT * placementVelocity,
  );

  return {
    value: Math.round(value * 100) / 100,
    components: {
      freshnessRatio: Math.round(freshnessRatio * 100) / 100,
      metDemand: Math.round(metDemand * 100) / 100,
      placementVelocity: Math.round(placementVelocity * 100) / 100,
    },
    computedAt: new Date().toISOString(),
  };
}

export interface LmiTrend {
  current: LmiBreakdown;
  /** Most-recent snapshot from `lmi_snapshots`. NULL on first run. */
  previous: { value: number; capturedAt: string } | null;
}

export async function lmiWithTrend(): Promise<LmiTrend> {
  const current = await computeLmi();
  const db = getDb();
  let previous: LmiTrend["previous"] = null;
  try {
    // Neon's raw `execute()` returns timestamps as ISO strings, not Date
    // objects. Normalise through `new Date()` so the output is a canonical
    // ISO 8601 string regardless.
    const rows = (await db.execute(sql`
      SELECT value, captured_at
      FROM lmi_snapshots
      ORDER BY captured_at DESC
      LIMIT 1
    `)) as unknown as {
      rows: Array<{ value: string; captured_at: string | Date }>;
    };
    const last = rows.rows[0];
    if (last) {
      previous = {
        value: Number(last.value),
        capturedAt: new Date(last.captured_at).toISOString(),
      };
    }
  } catch {
    // lmi_snapshots may not have rows yet  caller renders with previous=null.
  }
  return { current, previous };
}
