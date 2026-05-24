/**
 * Phase 9.7.2  Nationality-split aggregate queries (gov / admin only).
 *
 * Population-level supply + status breakdowns, optionally split by a
 * **two-class** `nationality_class` derivation:
 *   - `sa_citizen`        → profiles.is_citizen = true
 *   - `foreign_national`  → profiles.is_citizen = false
 *
 * NEVER country-level. Raw `nationality` stays on the individual
 * (redacted) profile; it never aggregates here. Country-level cells
 * re-identify faster AND would convert this surface into a targeting
 * tool the moment someone wanted to filter by "Nigerian welders" etc.
 * The 2-class abstraction removes both risks at once. Compliance
 * assertion (e) in 9.7.9 will enforce this structurally.
 *
 * Every returned dataset:
 *   1. Filters out soft-deleted profiles (`deleted_at IS NULL`).
 *   2. Is freshness-weighted via `sebenza_freshness_confidence()`.
 *   3. Runs through `suppress()` (k=10 via `outcomes_min_cohort_size`
 *      reused as the analytics floor; one knob across the system).
 *
 * Compliance assertion (a) in 9.7.9 verifies that no cell below the
 * floor is ever returned by these functions  including from the CSV
 * export path.
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { suppress, type SuppressionAxis } from "@/lib/analytics/suppress";
import type { EmploymentStatus } from "@/lib/mock/types";

export type NationalityClass = "sa_citizen" | "foreign_national";

export interface SupplyByNationalityCell {
  province: string;
  profession: string;
  nationality_class: NationalityClass;
  supply: number;
  freshness: number;
}

export interface StatusMixByNationalityCell {
  status: EmploymentStatus;
  nationality_class: NationalityClass;
  count: number;
  freshness: number;
}

export interface NationalitySupplyResult {
  cells: SupplyByNationalityCell[];
  k: number;
  suppressed: number;
}

export interface NationalityStatusResult {
  cells: StatusMixByNationalityCell[];
  k: number;
  suppressed: number;
}

// Complementary-suppression passes for supply cells. Two passes  one
// over the SA/foreign axis at each (province, profession) cell, and
// one over the province axis at each (profession, nationality_class)
// pair. Together they prevent recovery-by-subtraction of either
// dimension when the other axis has suppressed siblings.
const SUPPLY_AXES: SuppressionAxis<SupplyByNationalityCell>[] = [
  {
    groupBy: ["province", "profession"],
    complementOver: "nationality_class",
  },
  {
    groupBy: ["profession", "nationality_class"],
    complementOver: "province",
  },
];

// For the status mix, the complementary pass is across the
// nationality_class axis within each status bucket.
const STATUS_AXES: SuppressionAxis<StatusMixByNationalityCell>[] = [
  {
    groupBy: ["status"],
    complementOver: "nationality_class",
  },
];

/**
 * Supply per (province × profession × nationality_class) cell.
 * Optional `province` filter for the per-province deep-dive surface.
 */
export async function supplyByNationalityQuery(
  opts: { province?: string } = {},
): Promise<NationalitySupplyResult> {
  const db = getDb();
  const k = await getSetting<number>("outcomes_min_cohort_size");

  const provinceFilter = opts.province
    ? sql`AND province = ${opts.province}`
    : sql``;

  const rows = (
    (await db.execute(sql`
      SELECT
        province,
        profession,
        CASE WHEN is_citizen THEN 'sa_citizen' ELSE 'foreign_national' END
          AS nationality_class,
        COUNT(*)::int AS supply,
        COALESCE(AVG(sebenza_freshness_confidence(status_confirmed_at)), 0)::numeric
          AS freshness
      FROM profiles
      WHERE deleted_at IS NULL
        ${provinceFilter}
      GROUP BY province, profession, nationality_class
      ORDER BY province ASC, supply DESC
    `)) as unknown as {
      rows: Array<{
        province: string;
        profession: string;
        nationality_class: NationalityClass;
        supply: number;
        freshness: string;
      }>;
    }
  ).rows;

  const all: SupplyByNationalityCell[] = rows.map((r) => ({
    province: r.province,
    profession: r.profession,
    nationality_class: r.nationality_class,
    supply: r.supply,
    freshness: Number(r.freshness),
  }));

  const { passed, suppressedCount } = suppress(all, {
    countKey: "supply",
    k,
    axes: SUPPLY_AXES,
  });

  return { cells: passed, k, suppressed: suppressedCount };
}

/**
 * Status mix per (status × nationality_class) bucket. National-level
 * (no province filter)  the question this answers is whether the
 * SA-citizen workforce and the foreign-national workforce are in
 * different employment states overall.
 */
export async function statusMixByNationalityQuery(): Promise<NationalityStatusResult> {
  const db = getDb();
  const k = await getSetting<number>("outcomes_min_cohort_size");

  const rows = (
    (await db.execute(sql`
      SELECT
        status,
        CASE WHEN is_citizen THEN 'sa_citizen' ELSE 'foreign_national' END
          AS nationality_class,
        COUNT(*)::int AS count,
        COALESCE(AVG(sebenza_freshness_confidence(status_confirmed_at)), 0)::numeric
          AS freshness
      FROM profiles
      WHERE deleted_at IS NULL
      GROUP BY status, nationality_class
    `)) as unknown as {
      rows: Array<{
        status: EmploymentStatus;
        nationality_class: NationalityClass;
        count: number;
        freshness: string;
      }>;
    }
  ).rows;

  const all: StatusMixByNationalityCell[] = rows.map((r) => ({
    status: r.status,
    nationality_class: r.nationality_class,
    count: r.count,
    freshness: Number(r.freshness),
  }));

  const { passed, suppressedCount } = suppress(all, {
    countKey: "count",
    k,
    axes: STATUS_AXES,
  });

  return { cells: passed, k, suppressed: suppressedCount };
}
