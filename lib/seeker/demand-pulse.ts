/**
 * Phase 17 ("Demand Pulse")  turn the silent `search_events` signal into a
 * timely, motivating nudge: when employer demand for one of the seeker's own
 * skills (or their profession) SPIKES in their province this week, tell them.
 *
 * Reuses the same demand source + matching the Career Compass uses (province
 * via `filters->>'province'`, free-text ILIKE on terms / query / profession).
 * Demand-side activity only (employer searches)  province-level, never a
 * seeker cohort  so there is no k-anonymity exposure (same D2 posture as
 * `getNearYouDemand`). Pure read; flag-gated by the callers.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { PROVINCES } from "@/lib/mock/taxonomy";

export interface DemandPulse {
  /** The heating skill or profession label (e.g. "Plating"). */
  label: string;
  kind: "profession" | "skill";
  /** Province label, echoed for the copy. */
  province: string;
  /** Employer searches in the last 7 days (province-scoped). */
  thisWeek: number;
  /** Average weekly searches over the prior 3 weeks (the baseline). */
  priorWeekly: number;
}

/** Need at least this many searches THIS week before it counts as a pulse. */
const PULSE_FLOOR = 3;
const SKILL_CANDIDATES = 3;

function unwrap<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/**
 * The single biggest positive demand mover for this seeker this week, or null
 * when nothing is genuinely heating up (the honest empty state).
 */
export async function getDemandPulse(profile: {
  profession: string;
  province: string;
  topSkills: { name: string }[];
}): Promise<DemandPulse | null> {
  const db = getDb();
  const provinceSlug =
    PROVINCES.find(
      (p) => p.label.toLowerCase() === profile.province.trim().toLowerCase(),
    )?.slug ?? profile.province.trim().toLowerCase().replace(/\s+/g, "-");

  const candidates: { label: string; kind: "profession" | "skill" }[] = [
    { label: profile.profession, kind: "profession" as const },
    ...profile.topSkills
      .slice(0, SKILL_CANDIDATES)
      .map((s) => ({ label: s.name, kind: "skill" as const })),
  ].filter((c) => c.label && c.label.trim().length >= 2);

  const counts = await Promise.all(
    candidates.map(async (c) => {
      const rows = unwrap<{ this_week: number; prior_3w: number }>(
        await db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE at >= now() - interval '7 days')::int AS this_week,
            COUNT(*) FILTER (
              WHERE at >= now() - interval '28 days' AND at < now() - interval '7 days'
            )::int AS prior_3w
          FROM search_events
          WHERE filters->>'province' = ${provinceSlug}
            AND (
              LOWER(COALESCE(terms, '')) LIKE '%' || LOWER(${c.label}) || '%'
              OR LOWER(COALESCE(filters->>'query', '')) LIKE '%' || LOWER(${c.label}) || '%'
              OR LOWER(COALESCE(filters->>'profession', '')) = LOWER(${c.label})
            )
        `),
      );
      const r = rows[0] ?? { this_week: 0, prior_3w: 0 };
      return { ...c, thisWeek: r.this_week, priorWeekly: r.prior_3w / 3 };
    }),
  );

  const movers = counts
    .filter((c) => c.thisWeek >= PULSE_FLOOR && c.thisWeek > c.priorWeekly)
    .sort(
      (a, b) => b.thisWeek - b.priorWeekly - (a.thisWeek - a.priorWeekly),
    );
  const top = movers[0];
  if (!top) return null;

  return {
    label: top.label,
    kind: top.kind,
    province: profile.province,
    thisWeek: top.thisWeek,
    priorWeekly: Math.round(top.priorWeekly * 10) / 10,
  };
}
