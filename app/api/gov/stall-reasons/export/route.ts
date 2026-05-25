/**
 * Phase 9.13.4  CSV export of the cross-market stall-reason
 * breakdown ("why learners stall").
 *
 *   GET /api/gov/stall-reasons/export
 *
 * `gov` / `admin` only. The query already enforces the
 * `outcomes_research` consent gate (D1) + `suppress()` (k=10) + the
 * two complementary axes  no way to bypass either from this route.
 *
 * Audit-logged as `analytics.export` with the surface + row count + k
 * + suppressed count so the 9.7.7 oversight log captures every
 * cross-market export of learner-stall intelligence.
 */

import { NextResponse } from "next/server";
import { verifyGov } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import { stallReasonAggregateQuery } from "@/db/queries/stall-reasons";

export async function GET(_request: Request) {
  const session = await verifyGov();

  const result = await stallReasonAggregateQuery();

  const body = csvFromRows(
    ["skill_slug", "province_slug", "reason", "count", "freshness"],
    result.cells.map((c) => [
      c.skill_slug,
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
      surface: "/gov/shortage#stall-reasons",
      rowCount: result.cells.length,
      k: result.k,
      suppressed: result.suppressed,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition("stall-reasons"),
      "Cache-Control": "no-store",
    },
  });
}
