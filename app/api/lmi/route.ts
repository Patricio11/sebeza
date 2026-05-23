/**
 * Phase 9  Sebenza Labour Market Index public endpoint.
 *
 *   GET /api/lmi → { value, components, computedAt, previous }
 *
 * Unauthenticated by design  media + researchers + the policy team
 * pull this. ISR'd via the response Cache-Control header. The formula
 * is documented at /privacy and in the source comments; this endpoint
 * does NOT return individual-level data, only the cohort-level index.
 */

import { NextResponse } from "next/server";
import { lmiWithTrend } from "@/lib/analytics/lmi";

export const revalidate = 300; // 5 min

export async function GET() {
  const { current, previous } = await lmiWithTrend();
  return NextResponse.json(
    {
      index: "Sebenza Labour Market Index",
      value: current.value,
      components: current.components,
      computedAt: current.computedAt,
      previous,
      formula:
        "0.4 × freshness_ratio + 0.4 × (1 - normalised_gap) + 0.2 × placement_velocity",
      note:
        "Opinionated index. Not an official Stats SA statistic. See /privacy and /paia for context.",
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
