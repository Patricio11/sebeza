import type { AnalyticsSnapshot } from "./types";

// Aggregate, freshness-weighted mock. Powers /insights and the landing pulse strip.
// Numbers are illustrative; no real data is implied. Phase 6 derives these from
// materialised views.
export const mockAnalytics: AnalyticsSnapshot = {
  totalActive: 48213,
  confirmedHiresThisMonth: 1147,
  byStatus: {
    open_to_work: { count: 19120, freshnessConfidence: 0.78 },
    unemployed: { count: 14880, freshnessConfidence: 0.71 },
    employed: { count: 9210, freshnessConfidence: 0.66 },
    self_employed: { count: 3300, freshnessConfidence: 0.69 },
    studying: { count: 1703, freshnessConfidence: 0.82 },
  },
  demandBySkill: [
    { skill: "Software Developer", searches: 4200, matches: 1100 },
    { skill: "Chef", searches: 1800, matches: 1650 },
    { skill: "Electrician", searches: 1500, matches: 480 },
    { skill: "Nurse", searches: 1240, matches: 980 },
    { skill: "Boilermaker", searches: 980, matches: 210 },
    { skill: "Driver", searches: 870, matches: 1320 },
  ],
  trend: [
    { month: "2026-01", registrations: 5200, placements: 720 },
    { month: "2026-02", registrations: 6100, placements: 810 },
    { month: "2026-03", registrations: 7400, placements: 980 },
    { month: "2026-04", registrations: 8050, placements: 1030 },
    { month: "2026-05", registrations: 8800, placements: 1147 },
  ],
};

/** Aggregate confidence (weighted by count) for "data you can trust" badging. */
export function overallFreshnessConfidence(s: AnalyticsSnapshot): number {
  const entries = Object.values(s.byStatus);
  const total = entries.reduce((acc, x) => acc + x.count, 0);
  if (total === 0) return 0;
  const weighted = entries.reduce(
    (acc, x) => acc + x.count * x.freshnessConfidence,
    0,
  );
  return weighted / total;
}
