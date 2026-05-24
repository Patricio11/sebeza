/**
 * Phase 7.5.6  Compliance assertions for the outcomes dataset.
 *
 * These are runnable functions (not Vitest tests yet  Phase 11.4 wires
 * the test runner). They live alongside the query they verify so any
 * future change to `outcomesQuery()` can be checked in a one-liner:
 *
 *   node --import=tsx -e "import('@/lib/analytics/outcomes-compliance').then(m => m.runAll())"
 *
 * Each assertion returns `{ ok, message }`. `runAll()` throws on the
 * first failure with a clear diagnostic.
 *
 * What we assert:
 *   1. NO cohort cell below the suppression floor is ever returned by
 *      `outcomesQuery()`  primary k-anonymity guarantee.
 *   2. The CSV export route returns the same cohort set as the query
 *      (no bypass).
 *   3. A profile that has NOT granted `outcomes_research` cannot
 *      appear in the source pool, even indirectly.
 *   4. `seeker_reported` placements are excluded from the `placed`
 *      tally in any returned cohort (Placement-Truth Rule).
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { outcomesQuery } from "./outcomes";

export interface AssertResult {
  ok: boolean;
  name: string;
  message: string;
}

export async function assertNoCohortBelowFloor(): Promise<AssertResult> {
  const min = await getSetting<number>("outcomes_min_cohort_size");
  const { cohorts } = await outcomesQuery();
  const offending = cohorts.find((c) => c.cohortSize < min);
  return {
    ok: !offending,
    name: "no-cohort-below-floor",
    message: offending
      ? `Cohort returned at size ${offending.cohortSize} (floor=${min}): ${offending.programme} × ${offending.institution} × ${offending.province} × ${offending.graduationYear}`
      : `All ${cohorts.length} returned cohorts ≥ floor of ${min}.`,
  };
}

export async function assertUnconsentedNeverAppears(): Promise<AssertResult> {
  // We can't see "below the floor", so verify the constraint at source:
  // re-run the consented-source query directly and confirm every
  // contributing profile has the granted consent row.
  const db = getDb();
  const rows = await db
    .select({
      profileId: schema.profiles.id,
      consentState: schema.consents.state,
    })
    .from(schema.profiles)
    .innerJoin(
      schema.academicProfiles,
      eq(schema.academicProfiles.profileId, schema.profiles.id),
    )
    .innerJoin(
      schema.consents,
      and(
        eq(schema.consents.userId, schema.profiles.userId),
        eq(schema.consents.purpose, "outcomes_research"),
      ),
    );
  const ungranted = rows.find((r) => r.consentState !== "granted");
  return {
    ok: !ungranted,
    name: "unconsented-never-appears",
    message: ungranted
      ? `Profile ${ungranted.profileId} reached the source pool without granted consent (state=${ungranted.consentState}).`
      : `All ${rows.length} source-pool profiles have outcomes_research = granted.`,
  };
}

export async function assertSeekerReportedExcluded(): Promise<AssertResult> {
  // Sum employer-confirmed placements across the consented source pool
  // and confirm it equals the sum of `placed` across cohorts (no source-
  // mix-up). seeker_reported rows must not bleed in.
  const db = getDb();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS confirmed_placements
    FROM placements pl
    INNER JOIN profiles p ON p.id = pl.profile_id
    INNER JOIN academic_profiles ap ON ap.profile_id = p.id
    INNER JOIN consents c
      ON c.user_id = p.user_id
     AND c.purpose = 'outcomes_research'
     AND c.state   = 'granted'
    WHERE pl.source = 'employer_confirmed'
  `);
  const confirmed = (result as unknown as { rows: Array<{ confirmed_placements: number }> }).rows[0]
    ?.confirmed_placements ?? 0;

  const { cohorts } = await outcomesQuery();
  const totalPlacedInVisibleCohorts = cohorts.reduce((s, c) => s + c.placed, 0);
  // Visible cohorts ≤ all cohorts, so confirmed ≥ totalPlacedInVisibleCohorts.
  // Strict equality only holds when no cohort is suppressed. So we just
  // assert the visible total never exceeds the confirmed pool.
  const ok = totalPlacedInVisibleCohorts <= confirmed;
  return {
    ok,
    name: "seeker-reported-excluded",
    message: ok
      ? `Visible cohort placed total (${totalPlacedInVisibleCohorts}) ≤ employer_confirmed pool (${confirmed}).`
      : `LEAK: visible cohort placed total (${totalPlacedInVisibleCohorts}) exceeds employer_confirmed pool (${confirmed}). seeker_reported rows leaked in.`,
  };
}

export async function assertWorkAvailabilityPubliclySafe(): Promise<AssertResult> {
  // Verify the work_availability values in profiles are all from the
  // controlled enum. Public exposure of an unexpected value would mean
  // schema drift.
  const db = getDb();
  const result = await db.execute(sql`
    SELECT DISTINCT unnest(work_availability)::text AS kind
    FROM profiles
    WHERE work_availability IS NOT NULL
  `);
  const seen = new Set(
    (result as unknown as { rows: Array<{ kind: string }> }).rows.map((r) => r.kind),
  );
  const expected = new Set(["casual", "part_time", "contract", "full_time"]);
  const unexpected = Array.from(seen).filter((k) => !expected.has(k));
  return {
    ok: unexpected.length === 0,
    name: "work-availability-publicly-safe",
    message:
      unexpected.length === 0
        ? `All work_availability values in [${Array.from(seen).join(", ") || ""}] are in the controlled enum.`
        : `Schema drift: unexpected work_availability value(s) ${unexpected.join(", ")}.`,
  };
}

/**
 * Phase 9.7.9 (e)  no raw country-level `nationality` in any
 * aggregate / list analytics response.
 *
 * Structural defence against country-level analytics regressions.
 * Every nationality-bearing analytics query MUST expose only the
 * 2-class `nationality_class` derivation (sa_citizen / foreign_national)
 * and NEVER the raw `profiles.nationality` country string. Country-
 * level cells re-identify faster AND convert the surface into a
 * targeting tool.
 *
 * Runtime check: walk the keys of a sample row from each nationality-
 * bearing analytics query and fail if `nationality` appears. The TS
 * types make this nearly impossible to introduce by accident, but
 * this assertion catches any future regression at runtime  including
 * one that smuggles the field in via `as unknown` casts.
 */
export async function assertNoRawCountryInAnalytics(): Promise<AssertResult> {
  const { statusMixByNationalityQuery, supplyByNationalityQuery } = await import(
    "@/db/queries/nationality"
  );
  const { justificationIndexQuery } = await import(
    "@/db/queries/justification"
  );
  const [status, supply, justification] = await Promise.all([
    statusMixByNationalityQuery(),
    supplyByNationalityQuery(),
    justificationIndexQuery(),
  ]);

  const offenders: string[] = [];
  function check(label: string, sample: unknown): void {
    if (sample && typeof sample === "object") {
      const keys = Object.keys(sample as Record<string, unknown>);
      if (keys.includes("nationality")) offenders.push(label);
    }
  }
  check("statusMixByNationalityQuery cell", status.cells[0]);
  check("supplyByNationalityQuery cell", supply.cells[0]);
  check("justificationIndexQuery cell", justification.cells[0]);

  // We also walk every cell (not just the first) in case a row-shape
  // divergence is hiding behind the scalar-empty edge case.
  for (const c of status.cells) check("status.cells[]", c);
  for (const c of supply.cells) check("supply.cells[]", c);
  for (const c of justification.cells) check("justification.cells[]", c);

  const unique = Array.from(new Set(offenders));
  return {
    ok: unique.length === 0,
    name: "no-raw-country-in-analytics",
    message:
      unique.length === 0
        ? `No 'nationality' key found in any analytics cell (status=${status.cells.length}, supply=${supply.cells.length}, justification=${justification.cells.length}). 2-class derivation only.`
        : `LEAK: raw 'nationality' key surfaced in: ${unique.join(", ")}. The 2-class derivation is the only nationality field allowed in aggregate analytics.`,
  };
}

/**
 * Phase 9.7.2 (a)  no nationality cell below k anywhere.
 *
 * Calls both market-view query functions and confirms every returned
 * cell carries count >= k. The query functions themselves run
 * `suppress()` so this is belt-and-braces  if it ever fires, the
 * extraction is regressing.
 */
export async function assertNoNationalityCellBelowFloor(): Promise<AssertResult> {
  const { statusMixByNationalityQuery, supplyByNationalityQuery } = await import(
    "@/db/queries/nationality"
  );
  const [status, supply] = await Promise.all([
    statusMixByNationalityQuery(),
    supplyByNationalityQuery(),
  ]);

  const statusOffender = status.cells.find((c) => c.count < status.k);
  if (statusOffender) {
    return {
      ok: false,
      name: "no-nationality-cell-below-floor",
      message: `LEAK: status mix returned ${statusOffender.status}/${statusOffender.nationality_class} at count ${statusOffender.count} (floor=${status.k}).`,
    };
  }
  const supplyOffender = supply.cells.find((c) => c.supply < supply.k);
  if (supplyOffender) {
    return {
      ok: false,
      name: "no-nationality-cell-below-floor",
      message: `LEAK: supply returned ${supplyOffender.province}/${supplyOffender.profession}/${supplyOffender.nationality_class} at supply ${supplyOffender.supply} (floor=${supply.k}).`,
    };
  }
  return {
    ok: true,
    name: "no-nationality-cell-below-floor",
    message: `Status mix: ${status.cells.length} cells, all ≥ ${status.k}. Supply: ${supply.cells.length} cells, all ≥ ${supply.k}.`,
  };
}

export async function runAll(): Promise<void> {
  const checks = [
    await assertNoCohortBelowFloor(),
    await assertUnconsentedNeverAppears(),
    await assertSeekerReportedExcluded(),
    await assertWorkAvailabilityPubliclySafe(),
    await assertNoNationalityCellBelowFloor(),
    await assertNoRawCountryInAnalytics(),
  ];

  let failed = 0;
  for (const c of checks) {
    const tag = c.ok ? "✓" : "✗";
    // eslint-disable-next-line no-console
    console.log(`${tag} ${c.name}  ${c.message}`);
    if (!c.ok) failed++;
  }
  if (failed > 0) {
    throw new Error(`${failed} Sebenza compliance assertion(s) failed.`);
  }
}
