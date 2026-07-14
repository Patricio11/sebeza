/**
 * Phase 23.2 ("Truth & Data Integrity")  real landing-page trends.
 *
 * Replaces the hardcoded "+8.2% MoM" / "+11% MoM" hero chips with computed
 * month-over-month deltas: new active profiles (member_since) and confirmed
 * placements (employer_confirmed, hired_at). Honesty rule: when last month has
 * no baseline (0), we return null and the chip is simply not rendered  we
 * never invent a percentage.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export interface LandingTrends {
  /** e.g. "+8.2% MoM"  null when last month has no baseline. */
  activesTrend: string | null;
  hiresTrend: string | null;
}

function formatTrend(thisMonth: number, lastMonth: number): string | null {
  if (lastMonth <= 0) return null;
  const pct = ((thisMonth - lastMonth) / lastMonth) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% MoM`;
}

export async function getLandingTrends(): Promise<LandingTrends> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE member_since >= date_trunc('month', now())
      )::int AS profiles_this,
      COUNT(*) FILTER (
        WHERE member_since >= date_trunc('month', now()) - interval '1 month'
          AND member_since <  date_trunc('month', now())
      )::int AS profiles_last,
      (SELECT COUNT(*)::int FROM placements
        WHERE source = 'employer_confirmed'
          AND hired_at >= date_trunc('month', now())) AS hires_this,
      (SELECT COUNT(*)::int FROM placements
        WHERE source = 'employer_confirmed'
          AND hired_at >= date_trunc('month', now()) - interval '1 month'
          AND hired_at <  date_trunc('month', now())) AS hires_last
    FROM profiles
    WHERE deleted_at IS NULL
  `);
  const row = (
    result as unknown as {
      rows: Array<{
        profiles_this: number;
        profiles_last: number;
        hires_this: number;
        hires_last: number;
      }>;
    }
  ).rows[0];
  if (!row) return { activesTrend: null, hiresTrend: null };

  return {
    activesTrend: formatTrend(row.profiles_this, row.profiles_last),
    hiresTrend: formatTrend(row.hires_this, row.hires_last),
  };
}
