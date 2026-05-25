/**
 * Phase 9.13.4  "Why learners stall" analytics.
 *
 * Aggregates `learning_items.abandon_reason` by (skill × province ×
 * reason) over rows in `state = 'abandoned'`. Sister query to 9.8.7's
 * decline-reasons aggregate (employer side); together they map both
 * ends of the SA education-to-work pipeline:
 *
 *   - 9.8.7  WHY ROLES GO UNFILLED  (employer-side, decline reasons)
 *   - 9.13.4 WHY LEARNERS STALL     (learner-side, abandon reasons)
 *
 * Per D1 in PHASE_9_13_PLAN.md the gov-facing inclusion set is gated
 * on `outcomes_research` consent. Per D5 there is NO provider
 * dimension  the dataset is about skill × geography × cost/access/
 * quality patterns, never which company's course is failing learners.
 * (Provider judgement is reputational territory; not what this
 * platform is for.) Per D6 the same `sebenza_freshness_confidence`
 * function 9.8.7 uses weights `abandoned_at`.
 *
 * No org-scoped variant: learning_items are seeker-private (9.12.7's
 * audience invariant). Only the gov-facing suppressed aggregate
 * exists.
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { suppress, type SuppressionAxis } from "@/lib/analytics/suppress";
import type { AbandonReasonValue } from "@/lib/seeker/learning-types";

export interface StallReasonCell {
  skill_slug: string;
  province_slug: string;
  reason: AbandonReasonValue;
  count: number;
  freshness: number;
}

export interface StallReasonResult {
  cells: StallReasonCell[];
  k: number;
  suppressed: number;
}

// Complementary suppression mirrors 9.8.7:
//   1. Within (skill, province)  one surviving reason + suppressed
//      siblings = reconstructable, drop.
//   2. Within (skill, reason)  same logic across provinces.
const STALL_AXES: SuppressionAxis<StallReasonCell>[] = [
  {
    groupBy: ["skill_slug", "province_slug"],
    complementOver: "reason",
  },
  {
    groupBy: ["skill_slug", "reason"],
    complementOver: "province_slug",
  },
];

export async function stallReasonAggregateQuery(): Promise<StallReasonResult> {
  const db = getDb();
  const k = await getSetting<number>("outcomes_min_cohort_size");

  // The join: learning_items → profiles → consents (the
  // outcomes_research gate per D1). A learner without granted
  // outcomes_research consent is structurally excluded from the
  // inclusion set, even before suppression runs.
  //
  // province from the seeker's profile; reason + abandoned_at from
  // the learning_items row. We pivot the province from text label to
  // slug downstream (the PROVINCES catalog labels are the storage
  // shape today; this matches 9.8.7's decline-reasons query
  // verbatim).
  const rows = (
    (await db.execute(sql`
      SELECT
        li.skill_slug,
        LOWER(REPLACE(p.province, ' ', '-')) AS province_slug,
        li.abandon_reason::text AS reason,
        COUNT(*)::int AS count,
        COALESCE(AVG(sebenza_freshness_confidence(li.abandoned_at)), 0)::numeric AS freshness
      FROM learning_items li
      INNER JOIN profiles p ON p.id = li.profile_id
      INNER JOIN consents c
        ON c.user_id = p.user_id
       AND c.purpose = 'outcomes_research'
       AND c.state = 'granted'
      WHERE li.state = 'abandoned'
        AND li.abandon_reason IS NOT NULL
        AND li.abandoned_at IS NOT NULL
        AND p.deleted_at IS NULL
      GROUP BY li.skill_slug, province_slug, reason
      ORDER BY li.skill_slug, province_slug, count DESC
    `)) as unknown as {
      rows: Array<{
        skill_slug: string;
        province_slug: string;
        reason: AbandonReasonValue;
        count: number;
        freshness: string;
      }>;
    }
  ).rows;

  const all: StallReasonCell[] = rows.map((r) => ({
    skill_slug: r.skill_slug,
    province_slug: r.province_slug,
    reason: r.reason,
    count: r.count,
    freshness: Number(r.freshness),
  }));

  const { passed, suppressedCount } = suppress(all, {
    countKey: "count",
    k,
    axes: STALL_AXES,
  });

  return {
    cells: passed,
    k,
    suppressed: suppressedCount,
  };
}
