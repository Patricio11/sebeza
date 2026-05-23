/**
 * Phase 8 — Nightly outcome-snapshots cron (Phase 7.5.4 hand-off).
 *
 * Runs `outcomesQuery()` and writes one row to `outcome_snapshots` per
 * cohort cell that cleared the suppression floor at capture time.
 * Diffing two snapshots by `captured_at` yields the year-over-year
 * placement-rate trend.
 *
 * The suppression filter applies to what gets snapshotted — the table
 * never holds below-floor cells, by design.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { outcomeSnapshots } from "@/db/schema";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { isAuthorizedCron } from "@/lib/cron/auth";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await outcomesQuery();
    const capturedAt = new Date();

    if (result.cohorts.length === 0) {
      return NextResponse.json({
        ok: true,
        capturedAt: capturedAt.toISOString(),
        rowsCaptured: 0,
        minCohortSize: result.minCohortSize,
        note: "No cohort cleared the suppression floor — nothing written.",
      });
    }

    const db = getDb();
    await db.insert(outcomeSnapshots).values(
      result.cohorts.map((c) => ({
        id: `osn_${randomUUID()}`,
        capturedAt,
        programme: c.programme,
        institution: c.institution,
        province: c.province,
        graduationYear: c.graduationYear,
        cohortSize: c.cohortSize,
        placed: c.placed,
        // Store as text so PG numeric rounding doesn't drift the rate.
        placementRate: String(c.placementRate),
        medianTimeToHireDays: c.medianTimeToHireDays,
        topDestinationProfession: c.topDestinationProfession,
        minCohortSize: result.minCohortSize,
      })),
    );

    return NextResponse.json({
      ok: true,
      capturedAt: capturedAt.toISOString(),
      rowsCaptured: result.cohorts.length,
      minCohortSize: result.minCohortSize,
      consentedProfileCount: result.consentedProfileCount,
      suppressedCohorts: result.suppressedCohorts,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.outcome-snapshots] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Snapshot failed." },
      { status: 500 },
    );
  }
}
