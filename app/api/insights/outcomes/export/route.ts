/**
 * Phase 7.5.4  CSV export of the longitudinal outcomes dataset.
 *
 * Reuses `outcomesQuery()` so the EXACT same suppression filter applies
 * to the export. There is no way to bypass the floor from this route
 *  that's the compliance contract.
 *
 * Hardened CSV path (Phase 6.5 pattern): OWASP injection guard,
 * UTF-8 BOM, CRLF line endings, RFC-4180 double-quote escaping.
 * Audit-logged as `analytics.export`.
 */

import { NextResponse } from "next/server";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { logAccess } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/dal";

function safeCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

export async function GET() {
  // Surface is public  `/insights` itself is unauthenticated. Audit
  // log records who triggered the export when known.
  const session = await getSessionUser();

  const outcomes = await outcomesQuery();

  const header = [
    "programme",
    "institution",
    "province",
    "graduation_year",
    "cohort_size",
    "placed",
    "placement_rate",
    "median_time_to_hire_days",
    "top_destination_profession",
  ];
  const lines = [header.map(safeCell).join(",")];
  for (const c of outcomes.cohorts) {
    lines.push(
      [
        c.programme,
        c.institution,
        c.province,
        c.graduationYear,
        c.cohortSize,
        c.placed,
        c.placementRate,
        c.medianTimeToHireDays ?? "",
        c.topDestinationProfession ?? "",
      ]
        .map(safeCell)
        .join(","),
    );
  }
  const body = "﻿" + lines.join("\r\n") + "\r\n";

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

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sebenza-outcomes-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
