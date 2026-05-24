/**
 * Phase 9.8.7  "Why roles go unfilled" analytics.
 *
 * Aggregates `vacancy_invitations.declineReason` by (profession ×
 * province × reason) over rows in `state='declined'`. Two callers:
 *
 *   1. **Employer-private** (`/employer/vacancies` summary): pass
 *      `orgId` to scope the join through `vacancies.organization_id`.
 *      No suppression  the employer's own org data is theirs to see
 *      in full.
 *
 *   2. **Cross-market** (`/gov/shortage` decline-reasons section + the
 *      `/api/gov/decline-reasons/export` CSV): omit `orgId`. The
 *      result runs through the existing `suppress()` engine with the
 *      same k floor used elsewhere (`outcomes_min_cohort_size`,
 *      default 10) plus complementary passes so a (profession,
 *      province) row with one surviving reason can't be reconstructed
 *      by subtraction from totals.
 *
 * Freshness-weighting: each row's freshness comes from
 * `sebenza_freshness_confidence(responded_at)`  the same SQL function
 * the Phase 4 ranking + 9.7 nationality cells use. Recent declines
 * dominate; two-year-old declines are still counted but down-weighted
 * to 0.25. This matters because hiring-market signals decay
 * (yesterday's salary mismatch is more interesting than 2024's).
 *
 * Cross-references the 9.7.3 Justification Index: a (profession,
 * province) cell where most declines cite `salary_not_competitive`
 * reinforces the local-shortage classification  the gap is real,
 * it's just *salary-driven* rather than *supply-driven*. The COMPLETE
 * doc explains how to read the two together.
 *
 * NB: `accepted_with_notice` is excluded by query construction (we
 * only count rows where `state='declined'`)  the D1 / 9.8.8 check
 * (e) rule that accept-with-notice is a yes, never a decline, is
 * baked into the WHERE clause.
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { suppress, type SuppressionAxis } from "@/lib/analytics/suppress";

export type DeclineReasonValue =
  | "already_employed"
  | "salary_not_competitive"
  | "location_not_feasible"
  | "skills_mismatch"
  | "role_not_what_im_looking_for"
  | "other"
  | "unspecified";

export const DECLINE_REASON_VALUES: DeclineReasonValue[] = [
  "already_employed",
  "salary_not_competitive",
  "location_not_feasible",
  "skills_mismatch",
  "role_not_what_im_looking_for",
  "other",
  "unspecified",
];

/** Human-readable labels for the breakdown UI. Order matches
 *  `DECLINE_REASON_VALUES` so the rendering is stable. */
export const DECLINE_REASON_LABEL: Record<DeclineReasonValue, string> = {
  already_employed: "Already employed",
  salary_not_competitive: "Salary not competitive",
  location_not_feasible: "Location not feasible",
  skills_mismatch: "Skills mismatch",
  role_not_what_im_looking_for: "Not the right role",
  other: "Other",
  unspecified: "No reason given",
};

export interface DeclineReasonCell {
  profession_slug: string;
  province_slug: string;
  reason: DeclineReasonValue;
  count: number;
  freshness: number;
}

export interface DeclineReasonResult {
  /** Suppressed cells (cross-market) or raw cells (employer-private). */
  cells: DeclineReasonCell[];
  /** k-floor in use (always returned for footer copy + audit meta). */
  k: number;
  /** Total cells dropped through primary + complementary suppression. */
  suppressed: number;
  /** True when the result is org-scoped (no suppression applied). */
  orgScoped: boolean;
}

// Complementary-suppression: two passes
//   1. Within (profession_slug, province_slug)  if a single surviving
//      reason can be reconstructed from the row total + suppressed
//      siblings, drop it.
//   2. Within (profession_slug, reason)  same logic across provinces.
// These mirror the SUPPLY_AXES pattern in nationality.ts.
const DECLINE_AXES: SuppressionAxis<DeclineReasonCell>[] = [
  {
    groupBy: ["profession_slug", "province_slug"],
    complementOver: "reason",
  },
  {
    groupBy: ["profession_slug", "reason"],
    complementOver: "province_slug",
  },
];

export interface DeclineReasonQueryArgs {
  /**
   * Org scope. When set, results are filtered to that org's vacancies
   * AND suppression is skipped (employer-private  their own data).
   * When omitted, the query is cross-market + suppressed.
   */
  orgId?: string;
}

export async function declineReasonAggregateQuery(
  args: DeclineReasonQueryArgs = {},
): Promise<DeclineReasonResult> {
  const db = getDb();
  const k = await getSetting<number>("outcomes_min_cohort_size");

  // Org-scope filter assembled outside the template literal so the
  // empty case is a true no-op (a one-token `sql\`\`` chunk).
  const orgFilter = args.orgId
    ? sql`AND v.organization_id = ${args.orgId}`
    : sql``;

  const rows = (
    (await db.execute(sql`
      SELECT
        v.profession_slug,
        v.province_slug,
        COALESCE(vi.decline_reason::text, 'unspecified') AS reason,
        COUNT(*)::int AS count,
        COALESCE(
          AVG(sebenza_freshness_confidence(vi.responded_at)), 0
        )::numeric AS freshness
      FROM vacancy_invitations vi
      INNER JOIN vacancies v ON v.id = vi.vacancy_id
      WHERE vi.state = 'declined'
        AND vi.responded_at IS NOT NULL
        ${orgFilter}
      GROUP BY v.profession_slug, v.province_slug, reason
      ORDER BY v.profession_slug, v.province_slug, count DESC
    `)) as unknown as {
      rows: Array<{
        profession_slug: string;
        province_slug: string;
        reason: DeclineReasonValue;
        count: number;
        freshness: string;
      }>;
    }
  ).rows;

  const all: DeclineReasonCell[] = rows.map((r) => ({
    profession_slug: r.profession_slug,
    province_slug: r.province_slug,
    reason: r.reason,
    count: r.count,
    freshness: Number(r.freshness),
  }));

  // Employer-private: their own org data, no suppression. Cross-
  // market: full disclosure-control pipeline.
  if (args.orgId) {
    return {
      cells: all,
      k,
      suppressed: 0,
      orgScoped: true,
    };
  }

  const { passed, suppressedCount } = suppress(all, {
    countKey: "count",
    k,
    axes: DECLINE_AXES,
  });

  return {
    cells: passed,
    k,
    suppressed: suppressedCount,
    orgScoped: false,
  };
}
