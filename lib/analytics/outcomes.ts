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
import { suppress, type SuppressionAxis } from "./suppress";

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

// Two complementary-suppression passes  the contract the outcomes
// engine has always run. Lifted to a module-scope constant so the
// shape is obvious from the call site and unit-testable in isolation.
const OUTCOMES_AXES: SuppressionAxis<RawRow>[] = [
  {
    // Row pass: within a (programme, institution, year) row, drop the
    // only surviving province if any sibling province was suppressed.
    groupBy: ["programme", "institution", "graduation_year"],
    complementOver: "province",
  },
  {
    // Column pass: within a (programme, institution, province) column,
    // drop the only surviving year if any sibling year was suppressed.
    groupBy: ["programme", "institution", "province"],
    complementOver: "graduation_year",
  },
];

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

  // Suppression: primary k-floor + two complementary passes (row across
  // provinces, column across graduation years). Algorithm extracted to
  // `lib/analytics/suppress.ts` in Phase 9.7.1 so the rest of 9.7
  // (nationality dimension, Justification Index) reuses the same engine.
  // Behaviour is unchanged  the test fixtures in `suppress.test.ts`
  // codify the contract, and the outcomes-compliance assertions still
  // verify it end-to-end at runtime.
  const { passed, suppressedCount } = suppress(rawRows, {
    countKey: "cohort_size",
    k: minCohortSize,
    axes: OUTCOMES_AXES,
  });

  const cohorts: OutcomeCohort[] = passed.map((r) => ({
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
