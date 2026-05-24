/**
 * Phase 9.7.3  CSV export of the Skills-Shortage Justification Index.
 *
 *   GET /api/gov/justification-index/export?province=<label>
 *
 * `gov` / `admin` only (via `verifyGov()`). The classifier + supply
 * suppression run INSIDE `justificationIndexQuery()`  this route
 * cannot bypass either filter by hitting the URL directly.
 *
 * One row per cell. The CSV carries the same component values the UI
 * tooltip shows, so an analyst working off the file can recompute any
 * classification against the published thresholds and verify it.
 *
 * Audit-logged as `analytics.export` with the surface + province
 * filter + counts in `meta`, feeding the 9.7.7 oversight log.
 */

import { NextResponse } from "next/server";
import { verifyGov } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import { justificationIndexQuery } from "@/db/queries/justification";

export async function GET(request: Request) {
  const session = await verifyGov();
  const url = new URL(request.url);
  const province = url.searchParams.get("province")?.slice(0, 80) || undefined;

  const result = await justificationIndexQuery({ province });

  const body = csvFromRows(
    [
      "profession",
      "province",
      "classification",
      "demand_score",
      "local_supply_ratio",
      "foreign_fill_share",
      "sa_supply_freshness_weighted",
      "total_placements",
      "foreign_placements",
    ],
    result.cells.map((c) => [
      c.profession,
      c.province,
      c.label,
      c.demand_score.toFixed(2),
      c.local_supply_ratio.toFixed(2),
      c.foreign_fill_share.toFixed(2),
      c.sa_supply.toFixed(2),
      c.total_placements,
      c.foreign_placements,
    ]),
  );

  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/gov/shortage-justification",
      province: province ?? null,
      rowCount: result.cells.length,
      k: result.k,
      suppressed: result.suppressed,
      demandWindowDays: result.demandWindowDays,
      thresholds: result.thresholds,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition(
        province
          ? `shortage-justification-${province.toLowerCase().replace(/\s+/g, "-")}`
          : "shortage-justification",
      ),
      "Cache-Control": "no-store",
    },
  });
}
