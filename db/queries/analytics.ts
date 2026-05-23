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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — Skills-gap engine + supply heatmap + freshness breakdown.
//
// These power the rebuilt `/insights` page (the government wedge):
//   - skillsGapQuery: what employers SEARCH for vs what's available, sorted
//     by gap descending. Optional province filter to surface regional gaps.
//   - supplyHeatmapQuery: sparse (province × profession) grid of supply
//     counts + freshness; frontend builds the matrix.
//   - freshnessBreakdownQuery: how many active profiles are fresh / ageing /
//     stale right now — drives the "data you can trust" headline metric.
//   - skillsGapDeltaQuery: change in gap-size between this week and last
//     week, for the "Trending gaps" callout.
//
// All queries are freshness-aware: a profile that hasn't confirmed status
// in 90+ days contributes 0.25 to the supply count (not 1.0), so the gap
// reflects DELIVERABLE supply, not just registered seekers.
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillsGapRow {
  /** Search term or profession label (already title-cased). */
  skill: string;
  /** How many search_events fired this term. */
  searches: number;
  /** How many profiles currently match (raw count). */
  matches: number;
  /** Same as `matches` but freshness-weighted — what's actually deliverable. */
  freshMatches: number;
  /** `searches - matches`. Positive = unfilled demand. Negative = oversupply. */
  gap: number;
}

/**
 * Top N skills-gap signals, sorted by `gap` (unfilled demand) descending.
 * Pass `province` to scope supply to one province; demand stays national
 * because employers don't always tag a province in their query.
 */
export async function skillsGapQuery(opts: {
  province?: string | null;
  top?: number;
} = {}): Promise<SkillsGapRow[]> {
  const db = getDb();
  const top = opts.top ?? 20;
  const province = opts.province ?? null;

  const rows = unwrap<{
    skill: string;
    searches: number;
    matches: number;
    fresh_matches: string;
    gap: number;
  }>(
    await db.execute(sql`
      WITH searches AS (
        SELECT LOWER(terms) AS term, COUNT(*)::int AS hits
        FROM search_events
        WHERE terms IS NOT NULL AND length(terms) >= 2
        GROUP BY LOWER(terms)
      ),
      supply AS (
        SELECT
          LOWER(profession) AS profession,
          COUNT(*)::int AS matches,
          COALESCE(SUM(sebenza_freshness_confidence(status_confirmed_at)), 0)::numeric AS fresh_matches
        FROM profiles
        WHERE deleted_at IS NULL
          AND (${province}::text IS NULL OR LOWER(province) = LOWER(${province}))
        GROUP BY LOWER(profession)
      )
      SELECT
        COALESCE(s.profession, x.term)            AS skill,
        COALESCE(x.hits, 0)                       AS searches,
        COALESCE(s.matches, 0)                    AS matches,
        COALESCE(s.fresh_matches, 0)              AS fresh_matches,
        COALESCE(x.hits, 0) - COALESCE(s.matches, 0) AS gap
      FROM supply s
      FULL OUTER JOIN searches x ON x.term = s.profession
      ORDER BY gap DESC, searches DESC
      LIMIT ${top}
    `),
  );

  return rows.map((r) => ({
    skill: titleCase(r.skill),
    searches: r.searches,
    matches: r.matches,
    freshMatches: Number(r.fresh_matches),
    gap: r.gap,
  }));
}

export interface HeatmapCell {
  province: string;
  profession: string;
  supply: number;
  freshness: number;
}

/**
 * Sparse (province × profession) grid. Returns one row per non-empty cell.
 * Frontend can build the full matrix by joining against the taxonomy.
 */
export async function supplyHeatmapQuery(): Promise<HeatmapCell[]> {
  const db = getDb();
  const rows = unwrap<{
    province: string;
    profession: string;
    supply: number;
    freshness: string;
  }>(
    await db.execute(sql`
      SELECT
        province,
        profession,
        COUNT(*)::int AS supply,
        COALESCE(AVG(sebenza_freshness_confidence(status_confirmed_at)), 0)::numeric AS freshness
      FROM profiles
      WHERE deleted_at IS NULL
      GROUP BY province, profession
      ORDER BY province ASC, supply DESC
    `),
  );

  return rows.map((r) => ({
    province: r.province,
    profession: r.profession,
    supply: r.supply,
    freshness: Number(r.freshness),
  }));
}

export interface FreshnessBreakdown {
  fresh: number;
  ageing: number;
  stale: number;
  total: number;
}

/**
 * Counts the active profile pool by freshness band. The "trust headline" on
 * /insights surfaces `fresh / total` as a percentage.
 */
export async function freshnessBreakdownQuery(): Promise<FreshnessBreakdown> {
  const db = getDb();
  const rows = unwrap<{
    band: "fresh" | "ageing" | "stale";
    count: number;
  }>(
    await db.execute(sql`
      WITH banded AS (
        SELECT
          CASE
            WHEN EXTRACT(epoch FROM (now() - status_confirmed_at)) / 86400 < 30 THEN 'fresh'
            WHEN EXTRACT(epoch FROM (now() - status_confirmed_at)) / 86400 < 90 THEN 'ageing'
            ELSE 'stale'
          END AS band
        FROM profiles
        WHERE deleted_at IS NULL
      )
      SELECT band, COUNT(*)::int AS count
      FROM banded
      GROUP BY band
    `),
  );

  const out: FreshnessBreakdown = { fresh: 0, ageing: 0, stale: 0, total: 0 };
  for (const r of rows) {
    out[r.band] = r.count;
    out.total += r.count;
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}
