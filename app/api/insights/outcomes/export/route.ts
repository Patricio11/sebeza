/**
 * Phase 7.5.4  CSV export of the longitudinal outcomes dataset.
 *
 * Reuses `outcomesQuery()` so the EXACT same suppression filter applies
 * to the export. There is no way to bypass the floor from this route
 *  that's the compliance contract.
 *
 * CSV encoding (OWASP guard + UTF-8 BOM + CRLF + RFC 4180) lives in
 * the shared `lib/analytics/csv` helper since Phase 9.7.2.
 * Audit-logged as `analytics.export`.
 */

import { NextResponse } from "next/server";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { logAccess } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/dal";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";

export async function GET() {
  // Surface is public  `/insights` itself is unauthenticated. Audit
  // log records who triggered the export when known.
  const session = await getSessionUser();

  const outcomes = await outcomesQuery();

  const body = csvFromRows(
    [
      "programme",
      "institution",
      "province",
      "graduation_year",
      "cohort_size",
      "placed",
      "placement_rate",
      "median_time_to_hire_days",
      "top_destination_profession",
    ],
    outcomes.cohorts.map((c) => [
      c.programme,
      c.institution,
      c.province,
      c.graduationYear,
      c.cohortSize,
      c.placed,
      c.placementRate,
      c.medianTimeToHireDays ?? "",
      c.topDestinationProfession ?? "",
    ]),
  );

  await logAccess({
    kind: "analytics.export",
    actor: session?.id ?? "anonymous",
    meta: {
      surface: "/insights/outcomes",
      cohortRows: outcomes.cohorts.length,
      minCohortSize: outcomes.minCohortSize,
      suppressedCohorts: outcomes.suppressedCohorts,
      consentedProfileCount: outcomes.consentedProfileCount,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition("outcomes"),
      "Cache-Control": "no-store",
    },
  });
}
