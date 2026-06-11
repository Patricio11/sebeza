/**
 * Phase 12 (Task 12.2) — Status-Freshness Rule against the real database.
 *
 * Two contracts:
 *
 *   1. ONE-SOURCE-OF-TRUTH PARITY: the SQL function
 *      `sebenza_freshness_confidence(timestamp)` (Phase 4 — used by search
 *      ranking + every gov analytics query) must agree with
 *      `lib/status.ts` for the same ages, including at the 30/90-day band
 *      boundaries. If these drift, search ranking and the dashboard nudge
 *      tell users two different stories.
 *
 *   2. RANKING: with everything else held equal, a fresh profile outranks
 *      a stale one; and (Phase 13.10 D7) a primary-profession match ranks
 *      above a secondary-profession match.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { searchProfilesQuery } from "@/db/queries/profiles";
import { freshnessBand, freshnessConfidence } from "@/lib/status";

const db = getDb();

describe("SQL ↔ TypeScript freshness parity", () => {
  test.each([0, 5, 29, 30, 31, 45, 89, 90, 91, 120, 365])(
    "%i days old: SQL confidence equals lib/status.ts",
    async (days) => {
      const result = (await db.execute(
        sql`SELECT sebenza_freshness_confidence(now() - make_interval(days => ${days}))::float AS confidence`,
      )) as unknown as { rows: Array<{ confidence: number }> };
      const sqlConfidence = result.rows[0]!.confidence;
      const ts = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const tsConfidence = freshnessConfidence(freshnessBand(ts));
      expect(sqlConfidence, `at ${days} days`).toBeCloseTo(tsConfidence, 6);
    },
  );
});

describe("ranking behaviour on seeded data", () => {
  // Two seeded profiles get pinned to an identical baseline except for
  // status freshness; restored afterwards so later files see seed state.
  let freshHandle: string;
  let staleHandle: string;
  const saved: Array<{
    handle: string;
    profession: string;
    statusConfirmedAt: Date;
    completeness: number;
    /** Postgres text-literal form (e.g. `{Chef}`) or null — round-trips
     *  through `::text[]` casts without array-parameter binding issues. */
    secondaryProfessionsText: string | null;
  }> = [];

  beforeAll(async () => {
    const { profiles } = await searchProfilesQuery({});
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    freshHandle = profiles[0]!.handle;
    staleHandle = profiles[1]!.handle;

    for (const handle of [freshHandle, staleHandle]) {
      const r = (await db.execute(
        sql`SELECT handle, profession, status_confirmed_at, completeness,
                   secondary_professions::text AS secondary_professions_text
            FROM profiles WHERE handle = ${handle}`,
      )) as unknown as {
        rows: Array<{
          handle: string;
          profession: string;
          status_confirmed_at: Date;
          completeness: number;
          secondary_professions_text: string | null;
        }>;
      };
      const row = r.rows[0]!;
      saved.push({
        handle: row.handle,
        profession: row.profession,
        statusConfirmedAt: new Date(row.status_confirmed_at),
        completeness: row.completeness,
        secondaryProfessionsText: row.secondary_professions_text,
      });
    }

    // Identical baseline: same niche profession + completeness; only
    // status_confirmed_at differs (2 days vs 200 days).
    await db.execute(
      sql`UPDATE profiles SET profession = 'Phase12 Test Profession',
            completeness = 80, status_confirmed_at = now() - interval '2 days'
          WHERE handle = ${freshHandle}`,
    );
    await db.execute(
      sql`UPDATE profiles SET profession = 'Phase12 Test Profession',
            completeness = 80, status_confirmed_at = now() - interval '200 days'
          WHERE handle = ${staleHandle}`,
    );
  });

  afterAll(async () => {
    for (const s of saved) {
      await db.execute(
        sql`UPDATE profiles SET profession = ${s.profession},
              completeness = ${s.completeness},
              status_confirmed_at = ${s.statusConfirmedAt},
              secondary_professions = ${s.secondaryProfessionsText}::text[]
            WHERE handle = ${s.handle}`,
      );
    }
  });

  test("fresh outranks stale, all else equal (the moat, enforced)", async () => {
    const { profiles } = await searchProfilesQuery({
      profession: "Phase12 Test Profession",
    });
    const handles = profiles.map((p) => p.handle);
    expect(handles).toContain(freshHandle);
    expect(handles).toContain(staleHandle);
    expect(handles.indexOf(freshHandle)).toBeLessThan(
      handles.indexOf(staleHandle),
    );
  });

  test("13.10 D7: primary-profession match ranks above secondary-only match", async () => {
    // Flip the FRESH profile to a secondary-only match: its primary
    // becomes something else, the test profession moves to secondary.
    // The STALE profile keeps the primary match. Primary beats secondary
    // even though the secondary-matcher is much fresher.
    await db.execute(
      sql`UPDATE profiles SET profession = 'Phase12 Other Primary',
            secondary_professions = ARRAY['Phase12 Test Profession']
          WHERE handle = ${freshHandle}`,
    );

    const { profiles } = await searchProfilesQuery({
      profession: "Phase12 Test Profession",
    });
    const handles = profiles.map((p) => p.handle);
    expect(handles, "secondary match still included").toContain(freshHandle);
    expect(handles).toContain(staleHandle);
    expect(
      handles.indexOf(staleHandle),
      "primary (stale) must rank above secondary (fresh)",
    ).toBeLessThan(handles.indexOf(freshHandle));
  });
});
