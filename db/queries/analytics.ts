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
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
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

  // Match search terms to professions both ways: "react developer" matches
  // "Software Developer" (term contains "developer") AND "developer" matches
  // "Software Developer" (profession contains the term). FILTER + UNION
  // avoids many-to-many double-counting.
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
      ),
      -- For each profession, sum search hits across all matching terms.
      supply_with_demand AS (
        SELECT
          s.profession,
          s.matches,
          s.fresh_matches,
          COALESCE(
            SUM(x.hits) FILTER (
              WHERE x.term = s.profession
                 OR position(x.term IN s.profession) > 0
                 OR position(s.profession IN x.term) > 0
            ),
            0
          )::int AS hits
        FROM supply s
        LEFT JOIN searches x ON TRUE
        GROUP BY s.profession, s.matches, s.fresh_matches
      ),
      -- Terms that didn't match any profession — orphan demand: skills
      -- employers are looking for that don't map to the taxonomy yet.
      orphan_terms AS (
        SELECT x.term, x.hits
        FROM searches x
        WHERE NOT EXISTS (
          SELECT 1 FROM supply s
          WHERE x.term = s.profession
             OR position(x.term IN s.profession) > 0
             OR position(s.profession IN x.term) > 0
        )
      )
      SELECT profession AS skill, hits AS searches, matches,
             fresh_matches::numeric AS fresh_matches, (hits - matches)::int AS gap
        FROM supply_with_demand
      UNION ALL
      SELECT term AS skill, hits AS searches, 0 AS matches,
             0::numeric AS fresh_matches, hits AS gap
        FROM orphan_terms
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6.5 — Skill-level demand, skills-gap snapshots + trend deltas.
//
// `skillsGapQuery` operates at PROFESSION granularity. `skillDemandQuery`
// is the same idea but joins search terms against the controlled SKILL
// taxonomy (`skills.label`) — finer-grained, surfaces gaps like
// "Cybersecurity" that don't map to any profession yet.
//
// `captureSkillGapSnapshot` writes the current top-N skills-gap rows to
// `skill_gap_snapshots`. Runs nightly via the Phase 8 cron; in the
// meantime triggerable manually from the Phase 7 admin surface or
// `lib/analytics/snapshot.ts` Server Action.
//
// `skillsGapTrendQuery` reads the two most recent captures separated by
// at least N days and computes per-skill delta — drives the "Δ" arrow
// column on `/insights`.
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillDemandRow {
  /** Canonical skill label from the controlled taxonomy. */
  skill: string;
  /** Slug for downstream linking. */
  slug: string;
  /** Aggregate search hits whose term mentions this skill. */
  searches: number;
  /** How many profiles currently carry this skill. */
  matches: number;
  /** searches - matches (positive = unfilled demand). */
  gap: number;
}

/**
 * Skill-level demand vs supply. More granular than `skillsGapQuery` —
 * surfaces gaps that don't map to a profession (e.g. "Cybersecurity").
 */
export async function skillDemandQuery(opts: {
  top?: number;
} = {}): Promise<SkillDemandRow[]> {
  const db = getDb();
  const top = opts.top ?? 20;

  const rows = unwrap<{
    skill: string;
    slug: string;
    searches: number;
    matches: number;
    gap: number;
  }>(
    await db.execute(sql`
      WITH searches AS (
        SELECT LOWER(terms) AS term, COUNT(*)::int AS hits
        FROM search_events
        WHERE terms IS NOT NULL AND length(terms) >= 2
        GROUP BY LOWER(terms)
      ),
      skill_supply AS (
        SELECT
          s.slug,
          s.label,
          (SELECT COUNT(*)::int FROM profile_skills ps WHERE ps.skill_slug = s.slug) AS matches
        FROM skills s
      ),
      skill_demand AS (
        SELECT
          ss.slug,
          ss.label,
          ss.matches,
          COALESCE(SUM(x.hits) FILTER (
            WHERE x.term = LOWER(ss.label)
               OR position(LOWER(ss.label) IN x.term) > 0
               OR position(x.term IN LOWER(ss.label)) > 0
          ), 0)::int AS hits
        FROM skill_supply ss
        LEFT JOIN searches x ON TRUE
        GROUP BY ss.slug, ss.label, ss.matches
      )
      SELECT label AS skill, slug, hits AS searches, matches,
             (hits - matches)::int AS gap
      FROM skill_demand
      ORDER BY gap DESC, hits DESC, label ASC
      LIMIT ${top}
    `),
  );

  return rows.map((r) => ({
    skill: r.skill,
    slug: r.slug,
    searches: r.searches,
    matches: r.matches,
    gap: r.gap,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot capture + trend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Captures the current top-N skills-gap into the `skill_gap_snapshots`
 * table. Designed to run nightly via the Phase 8 cron, but exposed as a
 * regular async function so an admin can trigger an extra capture (e.g.
 * before publishing a policy brief).
 *
 * Returns the number of rows inserted (one per skill in the captured set).
 */
export async function captureSkillGapSnapshot(opts: {
  province?: string | null;
  top?: number;
} = {}): Promise<{ rowsCaptured: number; capturedAt: string }> {
  const db = getDb();
  const rows = await skillsGapQuery({ province: opts.province, top: opts.top ?? 50 });
  const capturedAt = new Date();

  if (rows.length === 0) {
    return { rowsCaptured: 0, capturedAt: capturedAt.toISOString() };
  }

  await db.insert(schema.skillGapSnapshots).values(
    rows.map((r) => ({
      id: `sgs_${randomUUID()}`,
      capturedAt,
      skill: r.skill,
      searches: r.searches,
      matches: r.matches,
      freshMatches: r.freshMatches.toFixed(4),
      gap: r.gap,
      province: opts.province ?? null,
    })),
  );

  return { rowsCaptured: rows.length, capturedAt: capturedAt.toISOString() };
}

export interface SkillsGapTrendRow extends SkillsGapRow {
  /** Δ vs the most-recent comparison snapshot. Null if no comparison exists. */
  gapDelta: number | null;
  /** Days between the current snapshot and the comparison. Null when there's no comparison. */
  comparedOverDays: number | null;
}

/**
 * Top-N skills-gap with week-over-week (or whatever's most recent within
 * the lookback window) deltas. Falls back to the current `skillsGapQuery`
 * result when there's no comparison snapshot yet — the page never breaks.
 */
export async function skillsGapTrendQuery(opts: {
  top?: number;
  /** Minimum age (days) of the comparison snapshot. Default: 7 (week-over-week). */
  lookbackDays?: number;
} = {}): Promise<SkillsGapTrendRow[]> {
  const db = getDb();
  const top = opts.top ?? 20;
  const lookbackDays = opts.lookbackDays ?? 7;

  // 1. Current values (always fresh).
  const current = await skillsGapQuery({ top });
  if (current.length === 0) return [];

  // 2. Find a comparison snapshot: most recent capture that's at least
  //    `lookbackDays` old. We pick from national snapshots (province IS NULL).
  const cmp = unwrap<{ skill: string; gap: number; captured_at: Date }>(
    await db.execute(sql`
      WITH latest_capture AS (
        SELECT captured_at
        FROM skill_gap_snapshots
        WHERE province IS NULL
          AND captured_at <= now() - (${lookbackDays} || ' days')::interval
        ORDER BY captured_at DESC
        LIMIT 1
      )
      SELECT skill, gap, captured_at
      FROM skill_gap_snapshots
      WHERE province IS NULL
        AND captured_at = (SELECT captured_at FROM latest_capture)
    `),
  );

  if (cmp.length === 0) {
    return current.map((r) => ({
      ...r,
      gapDelta: null,
      comparedOverDays: null,
    }));
  }

  const cmpByName = new Map(cmp.map((r) => [r.skill, r.gap]));
  const cmpAt = cmp[0]!.captured_at;
  const days = Math.round(
    (Date.now() - cmpAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  return current.map((r) => {
    const prior = cmpByName.get(r.skill);
    return {
      ...r,
      gapDelta: prior === undefined ? null : r.gap - prior,
      comparedOverDays: prior === undefined ? null : days,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rank in pool — for the seeker's "you're #4 of 312" headline
// ─────────────────────────────────────────────────────────────────────────────

export interface PoolRank {
  /** 1-based position. */
  rank: number;
  /** Total size of the (profession × province) pool. */
  poolTotal: number;
  /** Honest label for the pool. */
  poolLabel: string;
  /** Projected rank if the seeker added N more skills. Capped at 1. */
  projectedRank: number;
}

/**
 * Rank the given profile within its (profession + province) pool using the
 * same blend the search SQL does:
 *   freshness × (0.5 + 0.5 × completeness/100) × citizen_boost
 *
 * Used by the Career compass headline + the dashboard "Rank in search" tile.
 * Returns null if the profile isn't in the pool (e.g. completeness scoring
 * pushed them out — defensive but unlikely).
 */
export async function rankInPoolQuery(opts: {
  handle: string;
  profession: string;
  province: string;
  /** How many skills the seeker would hypothetically add for the projected rank. Default 2. */
  projectedSkillBoost?: number;
}): Promise<PoolRank | null> {
  const db = getDb();
  const boost = opts.projectedSkillBoost ?? 2;

  const rows = unwrap<{
    rank: number;
    pool_total: number;
  }>(
    await db.execute(sql`
      WITH pool AS (
        SELECT
          p.handle,
          p.completeness,
          DENSE_RANK() OVER (
            ORDER BY
              sebenza_freshness_confidence(p.status_confirmed_at) *
              (0.5 + 0.5 * (p.completeness::numeric / 100))
              DESC
          ) AS rank,
          COUNT(*) OVER () AS pool_total
        FROM profiles p
        WHERE p.deleted_at IS NULL
          AND LOWER(p.profession) = LOWER(${opts.profession})
          AND LOWER(p.province) = LOWER(${opts.province})
      )
      SELECT rank::int, pool_total::int
      FROM pool
      WHERE handle = ${opts.handle}
      LIMIT 1
    `),
  );

  const row = rows[0];
  if (!row) return null;

  // Projected rank: each skill added is worth ~6 points of completeness
  // (matches the lib/mock/helpers.computeCompleteness weighting). 2 new
  // skills → +12 points → reranks the seeker against the same pool.
  const completenessBoost = boost * 6;
  const projectedRows = unwrap<{ projected: number }>(
    await db.execute(sql`
      WITH pool AS (
        SELECT
          p.handle,
          DENSE_RANK() OVER (
            ORDER BY
              sebenza_freshness_confidence(p.status_confirmed_at) *
              (0.5 + 0.5 *
                ((p.completeness + CASE WHEN p.handle = ${opts.handle} THEN ${completenessBoost} ELSE 0 END)::numeric
                  / 100))
              DESC
          ) AS rank
        FROM profiles p
        WHERE p.deleted_at IS NULL
          AND LOWER(p.profession) = LOWER(${opts.profession})
          AND LOWER(p.province) = LOWER(${opts.province})
      )
      SELECT rank::int AS projected
      FROM pool
      WHERE handle = ${opts.handle}
      LIMIT 1
    `),
  );

  const projectedRank = Math.max(1, projectedRows[0]?.projected ?? row.rank);

  return {
    rank: row.rank,
    poolTotal: row.pool_total,
    poolLabel: `${opts.profession} · ${opts.province}`,
    projectedRank,
  };
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}
