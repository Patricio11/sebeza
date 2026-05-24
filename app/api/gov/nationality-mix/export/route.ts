/**
 * Phase 9.7.2  CSV export of the nationality-split analytics.
 *
 *   GET /api/gov/nationality-mix/export?dim=supply|status&province=<label>
 *
 * `gov` / `admin` only. The query functions already run `suppress()`
 * (k=10 via `outcomes_min_cohort_size`), so the rows we encode are
 * structurally guaranteed to be at or above the floor  there is no
 * way to bypass the floor from this route. The compliance contract
 * mirrors the outcomes-export route (Phase 7.5.4).
 *
 * Audit-logged as `analytics.export` with the surface + filter
 * parameters in `meta` for the 9.7.7 oversight log.
 */

import { NextResponse } from "next/server";
import { verifyGov } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import {
  statusMixByNationalityQuery,
  supplyByNationalityQuery,
} from "@/db/queries/nationality";

export async function GET(request: Request) {
  const session = await verifyGov();
  const url = new URL(request.url);
  const dim = url.searchParams.get("dim") === "status" ? "status" : "supply";
  const province = url.searchParams.get("province")?.slice(0, 80) || undefined;

  if (dim === "status") {
    const result = await statusMixByNationalityQuery();
    const body = csvFromRows(
      ["status", "nationality_class", "count", "freshness"],
      result.cells.map((c) => [
        c.status,
        c.nationality_class,
        c.count,
        c.freshness.toFixed(2),
      ]),
    );
    await logAccess({
      kind: "analytics.export",
      actor: session.id,
      meta: {
        surface: "/gov/nationality-mix",
        dim,
        rowCount: result.cells.length,
        k: result.k,
        suppressed: result.suppressed,
      },
    });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": csvDisposition("nationality-status"),
        "Cache-Control": "no-store",
      },
    });
  }

  // dim === "supply"
  const result = await supplyByNationalityQuery({ province });
  const body = csvFromRows(
    ["province", "profession", "nationality_class", "supply", "freshness"],
    result.cells.map((c) => [
      c.province,
      c.profession,
      c.nationality_class,
      c.supply,
      c.freshness.toFixed(2),
    ]),
  );
  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/gov/nationality-mix",
      dim,
      province: province ?? null,
      rowCount: result.cells.length,
      k: result.k,
      suppressed: result.suppressed,
    },
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition(
        province
          ? `nationality-supply-${province.toLowerCase().replace(/\s+/g, "-")}`
          : "nationality-supply",
      ),
      "Cache-Control": "no-store",
    },
  });
}
