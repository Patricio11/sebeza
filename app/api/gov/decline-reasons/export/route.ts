/**
 * Phase 9.8.7  CSV export of the cross-market decline-reason
 * breakdown ("why roles go unfilled").
 *
 *   GET /api/gov/decline-reasons/export
 *
 * `gov` / `admin` only. The query function already runs `suppress()`
 * (k=10 via `outcomes_min_cohort_size`, same knob as the rest of the
 * analytics layer)  the rows we encode are structurally at or above
 * the floor. There is no way to bypass the suppression from this
 * route, mirroring the Phase 9.7.2 nationality-mix export contract.
 *
 * Audit-logged as `analytics.export` with the surface + row count + k
 * + suppressed count so the 9.7.7 oversight log captures every
 * cross-market export of decline-reason intelligence.
 *
 * No org-scoped variant. Employer-private decline data renders on
 * `/employer/vacancies` and stays inside the employer's session;
 * exporting it would be a separate "your-org data export" surface
 * that 9.8 hasn't scoped.
 */

import { NextResponse } from "next/server";
import { verifyGov } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import { declineReasonAggregateQuery } from "@/db/queries/decline-reasons";

export async function GET(_request: Request) {
  const session = await verifyGov();

  const result = await declineReasonAggregateQuery();

  const body = csvFromRows(
    ["profession_slug", "province_slug", "reason", "count", "freshness"],
    result.cells.map((c) => [
      c.profession_slug,
      c.province_slug,
      c.reason,
      c.count,
      c.freshness.toFixed(2),
    ]),
  );

  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/gov/shortage#decline-reasons",
      rowCount: result.cells.length,
      k: result.k,
      suppressed: result.suppressed,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition("decline-reasons"),
      "Cache-Control": "no-store",
    },
  });
}
