/**
 * Phase 7.5.4  Longitudinal education-to-employment outcomes.
 *
 * The wedge  built so it can never re-identify a young person.
 *
 *   - Cohort dimensions: programme × institution × province × graduation_year.
 *     Never a per-person timeline. Never free-text in the cells.
 *   - Consented-only source: a profile contributes ONLY if it has a
 *     `consents` row with `purpose='outcomes_research', state='granted'`.
 *   - Hard k-anonymity floor: cohorts with fewer than `outcomes_min_cohort_size`
 *     distinct profiles are suppressed. Default N=10, tunable.
 *   - Complementary suppression: if the smallest visible cell in a row or
 *     column can be derived from totals, suppress the next-smallest too.
 *     This is the line that turns the floor from a fig leaf into actual
 *     statistical-disclosure control.
 *   - Employer-confirmed placements ONLY (Placement-Truth, 7.5.5). Seeker
 *     self-reports are excluded from this dataset, by policy.
 *
 * The suppression filter applies identically to the on-screen render
 * AND the CSV export  see the compliance assertion in 7.5.6.
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";

export interface OutcomeCohort {
  programme: string;
  institution: string;
  province: string;
  graduationYear: number;
  /** Distinct profiles in this cohort. Always ≥ minCohortSize. */
  cohortSize: number;
  /** Confirmed placements for this cohort (employer-confirmed only). */
  placed: number;
  /** Placement rate (placed / cohortSize), 0–1, rounded to 2dp. */
  placementRate: number;
  /** Median time-to-hire in days (null when no placements). */
  medianTimeToHireDays: number | null;
  /** Top destination profession (a placement's `role`, lowercased + counted). */
  topDestinationProfession: string | null;
}

export interface OutcomesQueryResult {
  /** Cohorts that cleared the floor (and complementary-suppression pass). */
  cohorts: OutcomeCohort[];
  /** k value applied. */
  minCohortSize: number;
  /** Suppressed-row count (primary + complementary). */
  suppressedCohorts: number;
  /** Total consented profiles in the source pool. */
  consentedProfileCount: number;
}

interface RawRow {
  programme: string;
  institution: string;
  province: string;
  graduation_year: number;
  cohort_size: number;
  placed: number;
  median_time_to_hire_days: number | null;
  top_destination_profession: string | null;
}

export async function outcomesQuery(): Promise<OutcomesQueryResult> {
  const db = getDb();
  const minCohortSize = await getSetting<number>("outcomes_min_cohort_size");

  // Pull every cohort cell, including small ones. We suppress in
  // application code (NOT in SQL) so the same suppression logic
  // runs against any future cached/snapshot source too.
  const result = await db.execute(sql`
    WITH consented AS (
      SELECT p.id AS profile_id,
             ap.programme,
             ap.institution_slug,
             p.province,
             -- expected_graduation is text yyyy-mm; we cohort by year
             SUBSTRING(ap.expected_graduation FROM 1 FOR 4)::int AS graduation_year
      FROM profiles p
      INNER JOIN academic_profiles ap ON ap.profile_id = p.id
      INNER JOIN consents c
        ON c.user_id = p.user_id
       AND c.purpose = 'outcomes_research'
       AND c.state   = 'granted'
      WHERE p.deleted_at IS NULL
    ),
    cohort_placements AS (
      SELECT c.profile_id,
             c.programme,
             c.institution_slug,
             c.province,
             c.graduation_year,
             pl.role,
             EXTRACT(EPOCH FROM (pl.hired_at - p.member_since)) / 86400.0 AS days_to_hire
      FROM consented c
      LEFT JOIN placements pl
        ON pl.profile_id = c.profile_id
       AND pl.source = 'employer_confirmed'
      LEFT JOIN profiles p ON p.id = c.profile_id
    ),
    sized AS (
      SELECT
        programme,
        institution_slug,
        province,
        graduation_year,
        COUNT(DISTINCT profile_id)::int AS cohort_size,
        COUNT(role)::int               AS placed,
        -- median (PG's percentile_cont)  null when no placements
        percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_hire)
          FILTER (WHERE role IS NOT NULL)
          AS median_time_to_hire_days,
        -- crude "top destination": most-frequent role in the cohort
        mode() WITHIN GROUP (ORDER BY role) FILTER (WHERE role IS NOT NULL)
          AS top_destination_profession
      FROM cohort_placements
      GROUP BY programme, institution_slug, province, graduation_year
    )
    SELECT
      programme,
      institution_slug AS institution,
      province,
      graduation_year,
      cohort_size,
      placed,
      median_time_to_hire_days,
      top_destination_profession
    FROM sized
    ORDER BY graduation_year DESC, cohort_size DESC
  `);

  const rawRows = (result as unknown as { rows: RawRow[] }).rows;

  const consentedProfileCount = rawRows.reduce((sum, r) => sum + r.cohort_size, 0);

  // ── Primary suppression: drop any cell below k.
  const passed = rawRows.filter((r) => r.cohort_size >= minCohortSize);
  let suppressedCount = rawRows.length - passed.length;

  // ── Complementary suppression.
  //
  // For each (programme × institution × graduation_year) row, if there
  // is exactly ONE surviving province cell AND we suppressed at least
  // one province at this row, the surviving cell's value can be recovered
  // by subtracting the visible cells from the row total. Drop it too.
  //
  // Same logic for each (programme × institution × province) column
  // across graduation years.
  const survivors = new Map<string, RawRow>();
  for (const r of passed) {
    survivors.set(rowKey(r), r);
  }

  function dropIfDerivable(group: Map<string, RawRow[]>): void {
    for (const cells of group.values()) {
      if (cells.length === 1 && hasSuppressedSiblingInGroup(cells[0]!, rawRows, group === byRow ? "province" : "graduation_year")) {
        survivors.delete(rowKey(cells[0]!));
        suppressedCount++;
      }
    }
  }

  // Group the survivors two ways: by row (drop province) and by column
  // (drop graduation year).
  const byRow = groupSurvivorsBy(passed, (r) =>
    `${r.programme}::${r.institution}::${r.graduation_year}`,
  );
  const byCol = groupSurvivorsBy(passed, (r) =>
    `${r.programme}::${r.institution}::${r.province}`,
  );

  dropIfDerivable(byRow);
  dropIfDerivable(byCol);

  const cohorts: OutcomeCohort[] = Array.from(survivors.values()).map((r) => ({
    programme: r.programme,
    institution: r.institution,
    province: r.province,
    graduationYear: r.graduation_year,
    cohortSize: r.cohort_size,
    placed: r.placed,
    placementRate:
      r.cohort_size > 0
        ? Math.round((r.placed / r.cohort_size) * 100) / 100
        : 0,
    medianTimeToHireDays:
      r.median_time_to_hire_days != null
        ? Math.round(Number(r.median_time_to_hire_days))
        : null,
    topDestinationProfession: r.top_destination_profession,
  }));

  return {
    cohorts,
    minCohortSize,
    suppressedCohorts: suppressedCount,
    consentedProfileCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rowKey(r: RawRow): string {
  return `${r.programme}::${r.institution}::${r.province}::${r.graduation_year}`;
}

function groupSurvivorsBy(
  rows: RawRow[],
  key: (r: RawRow) => string,
): Map<string, RawRow[]> {
  const out = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

/**
 * Returns true when the row's parent group (same programme +
 * institution + the "other" axis) had at least one suppressed
 * sibling  meaning the visible cell's value is derivable from
 * the row/column total. `axis` says whether the dropped sibling
 * varied by province (row group) or by graduation_year (col group).
 */
function hasSuppressedSiblingInGroup(
  row: RawRow,
  allRows: RawRow[],
  axis: "province" | "graduation_year",
): boolean {
  return allRows.some((r) => {
    if (r === row) return false;
    if (r.programme !== row.programme) return false;
    if (r.institution !== row.institution) return false;
    if (axis === "province") {
      if (r.graduation_year !== row.graduation_year) return false;
      // Sibling province at this row; was it suppressed?
      return r.cohort_size < row.cohort_size; // suppressed siblings are below k
    } else {
      if (r.province !== row.province) return false;
      return r.cohort_size < row.cohort_size;
    }
  });
}
