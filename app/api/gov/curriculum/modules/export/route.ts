/**
 * Phase 13.6  CSV export of the module-grain demand-vs-curriculum
 * breakdown.
 *
 *   GET /api/gov/curriculum/modules/export?province=<slug>
 *
 * Companion to the programme-grain export at
 * /api/gov/curriculum/export. Same suppression contract: the query
 * already ran suppress() at k = outcomes_min_cohort_size with the
 * two complementary axes; rows in the CSV are at or above the floor
 * by construction. There is no way to bypass suppression from this
 * route.
 *
 * Audit-logged as analytics.export with surface = /gov/curriculum
 * (same surface as the programme export, distinguished by the
 * `grain: 'module'` meta key) so the 9.7.7 oversight log captures
 * every export of curriculum intelligence.
 */

import { NextResponse } from "next/server";
import { verifyGov } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import { demandVsCurriculumByModule } from "@/db/queries/curriculum";
import { PROVINCES } from "@/lib/mock/taxonomy";

export async function GET(request: Request) {
  const session = await verifyGov();

  const url = new URL(request.url);
  const provinceParam = url.searchParams.get("province");
  const provinceFilter = provinceParam
    ? PROVINCES.find(
        (p) => p.slug === provinceParam || p.label === provinceParam,
      )
    : null;

  const result = await demandVsCurriculumByModule({
    provinceSlug: provinceFilter?.slug,
  });

  const body = csvFromRows(
    [
      "module_slug",
      "module_label",
      "institution_slug",
      "province_slug",
      "skill_slug",
      "skill_label",
      "confidence",
      "demand_score",
      "freshness",
      "gap_delta",
    ],
    result.cells.map((c) => [
      c.module_slug,
      c.module_label,
      c.institution_slug ?? "",
      c.province_slug ?? "",
      c.skill_slug,
      c.skill_label,
      c.confidence,
      c.demand_score,
      c.freshness.toFixed(2),
      c.gap_delta,
    ]),
  );

  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/gov/curriculum",
      grain: "module",
      provinceFilter: provinceFilter?.slug ?? null,
      rowCount: result.cells.length,
      k: result.k,
      suppressed: result.suppressed,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition("module-demand-gap"),
      "Cache-Control": "no-store",
    },
  });
}
