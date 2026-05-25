/**
 * Phase 9.13.3  CSV export of the cross-market curriculum-vs-demand
 * breakdown.
 *
 *   GET /api/gov/curriculum/export?province=<slug>
 *
 * `gov` / `admin` only. The query function already runs `suppress()`
 * (k=10 via `outcomes_min_cohort_size`)  the rows we encode are
 * structurally at or above the floor. There is no way to bypass
 * suppression from this route, mirroring the 9.7.2 nationality-mix +
 * 9.8.7 decline-reasons export contracts.
 *
 * Audit-logged as `analytics.export` with the surface + row count + k
 * + suppressed count so the 9.7.7 oversight log captures every
 * cross-market export of curriculum intelligence.
 */

import { NextResponse } from "next/server";
import { verifyGov } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import { demandVsCurriculumQuery } from "@/db/queries/curriculum";
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

  const result = await demandVsCurriculumQuery({
    provinceSlug: provinceFilter?.slug,
  });

  const body = csvFromRows(
    [
      "institution_slug",
      "programme",
      "province_slug",
      "skill_slug",
      "skill_label",
      "weight",
      "demand_score",
      "freshness",
      "in_programme",
    ],
    result.cells.map((c) => [
      c.institution_slug,
      c.programme,
      c.province_slug,
      c.skill_slug,
      c.skill_label,
      c.weight,
      c.demand_score,
      c.freshness.toFixed(2),
      c.in_programme ? "true" : "false",
    ]),
  );

  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/gov/curriculum",
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
      "Content-Disposition": csvDisposition("curriculum-vs-demand"),
      "Cache-Control": "no-store",
    },
  });
}
