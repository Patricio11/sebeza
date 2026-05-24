/**
 * Phase 9.7.3  Skills-Shortage Justification Index query layer.
 *
 * Builds one row per (profession × province) cell from three already-
 * collected signals:
 *
 *   demand_score        COUNT(DISTINCT actor_org_id) on search_events
 *                       in the trailing 30 days, divided by 10
 *                        Cell ÷ 10 so the headline value reads as a
 *                          multiple of "ten employers."
 *                        DISTINCT (per-org) closes the demand-
 *                          inflation vector where one motivated
 *                          employer hammers the same search 40 times.
 *
 *   local_supply_ratio  sa_supply ÷ (demand_score × 10)
 *                        sa_supply = freshness-weighted count of
 *                          SA-citizen profiles in the cell that are
 *                          available for work (open_to_work OR a
 *                          non-empty work_availability set).
 *
 *   foreign_fill_share  foreign_placements ÷ total_placements
 *                       (employer_confirmed only)
 *
 * The classifier (`lib/analytics/justification.classifyJustification`)
 * is pure and unit-tested; all the SQL plumbing lives here.
 *
 * Cells with `total_placements < employer_mix_min_placements` are still
 * returned by the query (so the UI can show them as indeterminate) but
 * carry the label `"indeterminate"`. Suppression is run on the SUPPLY
 * counts so the visible cells never reveal sub-k SA cohorts.
 *
 * Caveats baked into the data, not the code:
 *   - `search_events.actor_org_id` is nullable today (Phase 5 didn't
 *     yet wire org context on every search). Until that's done, the
 *     demand_score will under-count; many cells will sit at 0.
 *     Honest blank beats confident wrong number.
 *   - `is_citizen` is self-declared today. Home Affairs KYC stays
 *     dormant. R9 captures this in the DPIA.
 *   - Profession matching uses `LOWER(terms) = LOWER(profession)`
 *     exact match, same convention as the existing skillsGapQuery.
 *     Free-text "welders" vs "welder" won't match  taxonomy
 *     discipline is the contract.
 *   - Province on `search_events` is read from `filters->>'province'`;
 *     searches with no province filter are excluded from province-
 *     specific demand (they contribute nothing rather than ambient
 *     "all provinces" demand, which would be misattribution).
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { suppress } from "@/lib/analytics/suppress";
import {
  classifyJustification,
  type JustificationLabel,
  type JustificationThresholds,
} from "@/lib/analytics/justification";

export interface JustificationCell {
  profession: string;
  province: string;
  demand_score: number;
  sa_supply: number;
  total_placements: number;
  foreign_placements: number;
  local_supply_ratio: number;
  foreign_fill_share: number;
  label: JustificationLabel;
}

export interface JustificationResult {
  cells: JustificationCell[];
  thresholds: JustificationThresholds;
  k: number;
  suppressed: number;
  /** 30  the demand window we look back over. Surface for the UI. */
  demandWindowDays: number;
}

const DEMAND_WINDOW_DAYS = 30;

export async function justificationIndexQuery(
  opts: { province?: string } = {},
): Promise<JustificationResult> {
  const db = getDb();
  const [demandFloor, localSupplyThreshold, foreignFillFloor, minPlacements, k] =
    await Promise.all([
      getSetting<number>("lmi_demand_floor"),
      getSetting<number>("lmi_local_supply_threshold"),
      getSetting<number>("lmi_foreign_fill_floor"),
      getSetting<number>("employer_mix_min_placements"),
      getSetting<number>("outcomes_min_cohort_size"),
    ]);
  const thresholds: JustificationThresholds = {
    demandFloor,
    localSupplyThreshold,
    foreignFillFloor,
    minPlacements,
  };

  const provinceFilter = opts.province
    ? sql`AND province = ${opts.province}`
    : sql``;
  const provinceFilterSearch = opts.province
    ? sql`AND filters->>'province' ILIKE ${opts.province}`
    : sql``;
  const provinceFilterPlacements = opts.province
    ? sql`AND p.province = ${opts.province}`
    : sql``;

  // We pull the three signals as separate CTEs and FULL OUTER JOIN them
  // so any cell with at least ONE signal shows up. SQL stays readable
  // even with that many dimensions because each CTE is tiny.
  const rows = (
    (await db.execute(sql`
      WITH demand AS (
        SELECT
          LOWER(terms)                AS profession,
          filters->>'province'        AS province,
          COUNT(DISTINCT actor_org_id)::numeric / 10 AS demand_score
        FROM search_events
        WHERE at >= now() - (${DEMAND_WINDOW_DAYS} || ' days')::interval
          AND terms IS NOT NULL
          AND length(terms) >= 2
          AND actor_org_id IS NOT NULL
          AND filters->>'province' IS NOT NULL
          ${provinceFilterSearch}
        GROUP BY LOWER(terms), filters->>'province'
      ),
      sa_supply AS (
        SELECT
          LOWER(profession)           AS profession,
          province                    AS province,
          COALESCE(SUM(sebenza_freshness_confidence(status_confirmed_at)), 0)::numeric
                                       AS sa_supply
        FROM profiles
        WHERE deleted_at IS NULL
          AND is_citizen = true
          AND (status = 'open_to_work' OR cardinality(work_availability) > 0)
          ${provinceFilter}
        GROUP BY LOWER(profession), province
      ),
      placements_agg AS (
        SELECT
          LOWER(pl.role)              AS profession,
          p.province                  AS province,
          COUNT(*)::int               AS total_placements,
          COUNT(*) FILTER (WHERE p.is_citizen = false)::int
                                       AS foreign_placements
        FROM placements pl
        INNER JOIN profiles p ON p.id = pl.profile_id
        WHERE pl.source = 'employer_confirmed'
          AND p.deleted_at IS NULL
          ${provinceFilterPlacements}
        GROUP BY LOWER(pl.role), p.province
      )
      SELECT
        COALESCE(d.profession, s.profession, pa.profession) AS profession,
        COALESCE(d.province,   s.province,   pa.province)   AS province,
        COALESCE(d.demand_score, 0)::numeric                 AS demand_score,
        COALESCE(s.sa_supply, 0)::numeric                    AS sa_supply,
        COALESCE(pa.total_placements, 0)::int                AS total_placements,
        COALESCE(pa.foreign_placements, 0)::int              AS foreign_placements
      FROM demand d
      FULL OUTER JOIN sa_supply s
        ON s.profession = d.profession AND s.province = d.province
      FULL OUTER JOIN placements_agg pa
        ON pa.profession = COALESCE(d.profession, s.profession)
       AND pa.province   = COALESCE(d.province,   s.province)
      ORDER BY profession, province
    `)) as unknown as {
      rows: Array<{
        profession: string;
        province: string;
        demand_score: string;
        sa_supply: string;
        total_placements: number;
        foreign_placements: number;
      }>;
    }
  ).rows;

  // Build the typed cell list with derived ratios + the classifier label.
  const enriched: JustificationCell[] = rows.map((r) => {
    const demand_score = Number(r.demand_score);
    const sa_supply = Number(r.sa_supply);
    const total_placements = r.total_placements;
    const foreign_placements = r.foreign_placements;
    const demandTotal = demand_score * 10;
    const local_supply_ratio = demandTotal > 0 ? sa_supply / demandTotal : 0;
    const foreign_fill_share =
      total_placements > 0 ? foreign_placements / total_placements : 0;
    const label = classifyJustification(
      {
        demand_score,
        local_supply_ratio,
        foreign_fill_share,
        total_placements,
      },
      thresholds,
    );
    return {
      profession: r.profession,
      province: r.province,
      demand_score,
      sa_supply,
      total_placements,
      foreign_placements,
      local_supply_ratio,
      foreign_fill_share,
      label,
    };
  });

  // Apply the SUPPLY-side k-floor. Cells whose `sa_supply` is below k are
  // dropped  showing a small SA-citizen cohort plus a label of "shortage"
  // could re-identify the few people in it. We pass `sa_supply` rounded
  // up to int through `suppress()`. The classifier output sits on top of
  // the suppression; cells dropped here never reach the UI.
  const suppressInput = enriched.map((c) => ({
    ...c,
    sa_supply_int: Math.round(c.sa_supply),
  }));
  const { passed, suppressedCount } = suppress(suppressInput, {
    countKey: "sa_supply_int",
    k,
    axes: [
      // Row pass: within a profession, drop a lone surviving province
      // if any sibling province in that profession was suppressed.
      { groupBy: ["profession"], complementOver: "province" },
      // Col pass: within a province, drop a lone surviving profession
      // if any sibling profession was suppressed.
      { groupBy: ["province"], complementOver: "profession" },
    ],
  });

  // Strip the suppression-helper field before returning.
  const cells: JustificationCell[] = passed.map(
    ({ sa_supply_int: _drop, ...c }) => c,
  );

  return {
    cells,
    thresholds,
    k,
    suppressed: suppressedCount,
    demandWindowDays: DEMAND_WINDOW_DAYS,
  };
}
