/**
 * Phase 4 — Aggregate analytics queries.
 *
 * Drives `/insights` (public dashboard) and the landing pulse strip.
 *
 * Rules:
 *  - Aggregates only — never expose individual PII. Counts, weighted sums,
 *    trend buckets. No per-row data in the response.
 *  - Freshness-weighted: each `byStatus` bucket carries the average
 *    `sebenza_freshness_confidence` for the rows that contribute. Lets
 *    `/insights` show "data you can trust" honestly.
 *  - One round-trip per logical aggregate (counts / demandBySkill / trend) —
 *    Phase 6 may swap these for materialised views once row counts grow.
 *
 * `demandBySkill` is intentionally derived from `search_events` (what
 * employers SEARCH for) vs. `profile_skills` (what's available). The
 * "skills gap" surfaces wherever searches > matches. Phase 6 elevates this
 * to the government wedge.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type {
  AnalyticsSnapshot,
  EmploymentStatus,
} from "@/lib/mock/types";

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "employed",
  "unemployed",
  "self_employed",
  "studying",
  "open_to_work",
];

/** db.execute() with the neon-http driver returns a wrapper object whose
 *  `.rows` property carries the actual array. Tiny helper extracts it with
 *  the right shape, so the call-sites below stay readable. */
function unwrap<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

export async function analyticsSnapshotQuery(): Promise<AnalyticsSnapshot> {
  const db = getDb();

  // ── Status breakdown (counts + freshness confidence per bucket) ──────────
  const statusRows = unwrap<{
    status: EmploymentStatus;
    count: number;
    confidence: string;
  }>(
    await db.execute(sql`
      SELECT
        status,
        COUNT(*)::int AS count,
        COALESCE(AVG(sebenza_freshness_confidence(status_confirmed_at))::numeric, 0) AS confidence
      FROM profiles
      WHERE deleted_at IS NULL
      GROUP BY status
    `),
  );

  const byStatus = Object.fromEntries(
    EMPLOYMENT_STATUSES.map((s) => [s, { count: 0, freshnessConfidence: 0 }]),
  ) as AnalyticsSnapshot["byStatus"];

  for (const r of statusRows) {
    byStatus[r.status] = {
      count: r.count,
      freshnessConfidence: Number(r.confidence),
    };
  }

  // ── Active total ─────────────────────────────────────────────────────────
  const totalActive = Object.values(byStatus).reduce(
    (acc, b) => acc + b.count,
    0,
  );

  // ── Placements this month ────────────────────────────────────────────────
  const placementsRows = unwrap<{ count: number }>(
    await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM placements
      WHERE hired_at >= date_trunc('month', now())
    `),
  );
  const confirmedHiresThisMonth = placementsRows[0]?.count ?? 0;

  // ── Demand vs supply by profession (skills-gap signal) ───────────────────
  // Phase 6 will derive this from search_events × profile_skills; for the
  // Phase 4 cut we approximate by profession, which is what the search-bar
  // free text mostly targets today.
  const demandRows = unwrap<{
    skill: string;
    searches: number;
    matches: number;
  }>(
    await db.execute(sql`
      WITH searches AS (
        -- WHERE already excludes NULL terms, so no COALESCE; SELECT and
        -- GROUP BY must reference the exact same expression for Postgres.
        SELECT LOWER(terms) AS term, COUNT(*)::int AS hits
        FROM search_events
        WHERE terms IS NOT NULL AND length(terms) >= 2
        GROUP BY LOWER(terms)
      ),
      supply AS (
        SELECT LOWER(profession) AS profession, COUNT(*)::int AS matches
        FROM profiles
        WHERE deleted_at IS NULL
        GROUP BY LOWER(profession)
      )
      SELECT
        COALESCE(s.profession, x.term) AS skill,
        COALESCE(x.hits, 0) AS searches,
        COALESCE(s.matches, 0) AS matches
      FROM supply s
      FULL OUTER JOIN searches x ON x.term = s.profession
      ORDER BY searches DESC, matches DESC
      LIMIT 12
    `),
  );
  const demandBySkill = demandRows.map((r) => ({
    skill: titleCase(r.skill),
    searches: r.searches,
    matches: r.matches,
  }));

  // ── 5-month trend (registrations + placements) ───────────────────────────
  const trendRows = unwrap<{
    month: string;
    registrations: number;
    placements: number;
  }>(
    await db.execute(sql`
      WITH months AS (
        SELECT to_char(date_trunc('month', now()) - (g || ' months')::interval, 'YYYY-MM') AS month
        FROM generate_series(0, 4) AS g
      ),
      regs AS (
        SELECT to_char(date_trunc('month', member_since), 'YYYY-MM') AS month,
               COUNT(*)::int AS registrations
        FROM profiles
        WHERE deleted_at IS NULL
        GROUP BY 1
      ),
      places AS (
        SELECT to_char(date_trunc('month', hired_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS placements
        FROM placements
        GROUP BY 1
      )
      SELECT m.month,
             COALESCE(r.registrations, 0) AS registrations,
             COALESCE(p.placements, 0)    AS placements
      FROM months m
      LEFT JOIN regs   r ON r.month = m.month
      LEFT JOIN places p ON p.month = m.month
      ORDER BY m.month ASC
    `),
  );

  return {
    totalActive,
    confirmedHiresThisMonth,
    byStatus,
    demandBySkill,
    trend: trendRows.map((t) => ({
      month: t.month,
      registrations: t.registrations,
      placements: t.placements,
    })),
  };
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}
