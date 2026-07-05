/**
 * Phase 6  Career compass on real data.
 *
 * Replaces the Phase 1.5 `getCompassForHandle` (which returned a
 * MOCK_COMPASS constant for every user). This function reads the same
 * shape  `CompassSnapshot` from `lib/mock/growth.ts`  but composes it
 * from live DB queries so the page UI doesn't have to change.
 *
 * Inputs the seeker's profile + province; queries:
 *   1. Skills they DON'T have, ranked by recent search demand (last 90d)
 *      that hits the skill label as a free-text term  the "demand_high"
 *      reason chip.
 *   2. Skills common to higher-ranked profiles in the same profession +
 *      province  the "common_among_top_ranked" reason chip.
 *   3. Adjacent professions where the seeker's existing skill set
 *      overlaps ≥40%  the "adjacent_role" reason chip.
 *
 * Learning paths stay from the static SA-grounded catalog
 * (`lib/mock/growth.ts` LEARNING_PATHS)  Phase 7+ when an admin can
 * manage them is when that data moves to a DB table. For now the static
 * catalog is the right thing.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { SKILLS, PROFESSIONS, PROVINCES } from "@/lib/mock/taxonomy";
import {
  type CompassSnapshot,
  type SkillRecommendation,
  type AdjacentProfession,
  type LearningPath,
} from "@/lib/mock/growth";
// Phase 18 ("Living Learning Catalog"): the catalog now lives in the
// `learning_paths` table (admin-editable, seeker-rateable). `listAllLearningPaths`
// returns the same `LearningPath` shape in the same order the constant did, so
// `pickRelevantPaths` (a stable sort) renders identically.
import { listAllLearningPaths } from "@/db/queries/learning-paths";
import { listPrereqsForSkills } from "@/db/queries/skill-prereqs";
import { applyPrereqOrdering } from "@/lib/skills/prereq-graph";
import { getSetting } from "@/lib/admin/settings";
import type { PublicProfile, TaxonomyEntry } from "@/lib/mock/types";

const DEMAND_WINDOW_DAYS = 90;
const MAX_RECOMMENDATIONS = 5;
const MAX_LEARNING_PATHS = 4;
const MAX_ADJACENT = 3;
const OVERLAP_THRESHOLD = 0.4;

function unwrap<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

interface DemandRow {
  skill_slug: string;
  skill_label: string;
  searches: number;
  matches: number;
}

interface PeerSkillRow {
  skill_slug: string;
  skill_label: string;
  /** How many profiles in the same profession+province carry this skill. */
  peers: number;
}

interface CityDemandRow {
  skill: string;
  searches: number;
  matches: number;
  gap: number;
}

export async function getCompassForProfile(
  profile: PublicProfile & { profileId?: string },
): Promise<CompassSnapshot> {
  const db = getDb();

  // ── 1. Live demand for skills the seeker doesn't have ────────────────────
  // Search terms (last 90 days) matched against skill labels via ILIKE so
  // "react developer" search → matches "React" skill.
  const demandRows = unwrap<DemandRow>(
    await db.execute(sql`
      WITH recent_searches AS (
        SELECT LOWER(terms) AS term, COUNT(*)::int AS hits
        FROM search_events
        WHERE terms IS NOT NULL
          AND length(terms) >= 2
          AND at >= now() - (${DEMAND_WINDOW_DAYS} || ' days')::interval
        GROUP BY LOWER(terms)
      ),
      skill_match AS (
        SELECT
          s.slug   AS skill_slug,
          s.label  AS skill_label,
          COALESCE(SUM(rs.hits), 0)::int AS searches,
          (SELECT COUNT(*)::int FROM profile_skills ps WHERE ps.skill_slug = s.slug) AS matches
        FROM skills s
        LEFT JOIN recent_searches rs ON rs.term LIKE '%' || LOWER(s.label) || '%'
        WHERE s.slug NOT IN (
          SELECT skill_slug FROM profile_skills
          WHERE profile_id = (SELECT id FROM profiles WHERE handle = ${profile.handle} LIMIT 1)
        )
        GROUP BY s.slug, s.label
      )
      SELECT skill_slug, skill_label, searches, matches
      FROM skill_match
      WHERE searches > 0
      ORDER BY searches DESC, matches ASC
      LIMIT ${MAX_RECOMMENDATIONS}
    `),
  );

  // ── 2. Skills common among "top-ranked" peers (same profession + province)
  // Bootstrap heuristic: peers with `completeness >= 70` are "top-ranked".
  // Once Phase 6 introduces a real rank score this can become a percentile.
  const peerSkillRows = unwrap<PeerSkillRow>(
    await db.execute(sql`
      WITH peer_profiles AS (
        SELECT id
        FROM profiles
        WHERE deleted_at IS NULL
          AND handle <> ${profile.handle}
          AND LOWER(profession) = LOWER(${profile.profession})
          AND LOWER(province) = LOWER(${profile.province})
          AND completeness >= 70
      )
      SELECT
        s.slug  AS skill_slug,
        s.label AS skill_label,
        COUNT(*)::int AS peers
      FROM profile_skills ps
      JOIN skills s ON s.slug = ps.skill_slug
      WHERE ps.profile_id IN (SELECT id FROM peer_profiles)
        AND ps.skill_slug NOT IN (
          SELECT skill_slug FROM profile_skills
          WHERE profile_id = (SELECT id FROM profiles WHERE handle = ${profile.handle} LIMIT 1)
        )
      GROUP BY s.slug, s.label
      ORDER BY peers DESC
      LIMIT ${MAX_RECOMMENDATIONS}
    `),
  );

  // ── 3. City-level demand table (skills-gap by province for the rail) ─────
  const cityDemandRows = unwrap<CityDemandRow>(
    await db.execute(sql`
      WITH local_searches AS (
        SELECT LOWER(terms) AS term, COUNT(*)::int AS hits
        FROM search_events
        WHERE terms IS NOT NULL AND length(terms) >= 2
        GROUP BY LOWER(terms)
      ),
      local_supply AS (
        SELECT LOWER(profession) AS profession, COUNT(*)::int AS matches
        FROM profiles
        WHERE deleted_at IS NULL
          AND LOWER(province) = LOWER(${profile.province})
        GROUP BY LOWER(profession)
      )
      SELECT
        COALESCE(s.profession, x.term) AS skill,
        COALESCE(x.hits, 0) AS searches,
        COALESCE(s.matches, 0) AS matches,
        COALESCE(x.hits, 0) - COALESCE(s.matches, 0) AS gap
      FROM local_supply s
      FULL OUTER JOIN local_searches x ON x.term = s.profession
      ORDER BY gap DESC, searches DESC
      LIMIT 6
    `),
  );

  // ── 4. Compose recommendations (dedupe across demand + peer signals) ─────
  const seen = new Set<string>();
  const recommendations: SkillRecommendation[] = [];

  for (const row of demandRows) {
    if (seen.has(row.skill_slug) || recommendations.length >= MAX_RECOMMENDATIONS)
      break;
    seen.add(row.skill_slug);
    recommendations.push({
      skill: { slug: row.skill_slug, label: row.skill_label },
      reason: "demand_high",
      detail: `${row.searches} searches over the last ${DEMAND_WINDOW_DAYS} days mention this skill  and only ${row.matches} ${row.matches === 1 ? "person" : "people"} on Sebenza carries it.`,
      demandSignal: { searches: row.searches, matches: row.matches },
    });
  }

  for (const row of peerSkillRows) {
    if (seen.has(row.skill_slug) || recommendations.length >= MAX_RECOMMENDATIONS)
      break;
    seen.add(row.skill_slug);
    recommendations.push({
      skill: { slug: row.skill_slug, label: row.skill_label },
      reason: "common_among_top_ranked",
      detail: `${row.peers} ${row.peers === 1 ? "peer" : "peers"} in your profession + province carry this; you don't yet.`,
    });
  }

  // Phase 23.3  the {current: 0, projected: 0} placeholder that used to be
  // set here leaked a "#0 → #0" card to seekers. rankIfLearned is now set ONLY
  // by the grow page with the REAL boost-1 `rankInPoolQuery` projection; when
  // no real rank exists it stays absent and the card doesn't render.

  // ── 5. Adjacent professions (skill-overlap heuristic) ────────────────────
  const adjacentProfessions = await loadAdjacentProfessions(
    db,
    profile.handle,
    profile.profession,
  );

  // ── 5b. Prerequisite sequencing (Phase 20.1, flag-gated) ─────────────────
  // Re-order recommendations so a recommended prerequisite never sits below the
  // skill it unlocks, and annotate each with the prereqs the seeker still lacks
  // (the "Requires: X" pill). Pure re-rank — the demand math above is untouched.
  let orderedRecommendations: SkillRecommendation[] = recommendations;
  const prereqsEnabled = await getSetting<boolean>("feature_flag_skill_prereqs");
  if (prereqsEnabled && recommendations.length > 0) {
    const edges = await listPrereqsForSkills(
      recommendations.map((r) => r.skill.slug),
    );
    if (edges.length > 0) {
      const ownedResult = await db.execute(sql`
        SELECT skill_slug FROM profile_skills
        WHERE profile_id = (SELECT id FROM profiles WHERE handle = ${profile.handle} LIMIT 1)
      `);
      const ownedSlugs = new Set(
        (ownedResult as unknown as { rows: { skill_slug: string }[] }).rows.map(
          (r) => r.skill_slug,
        ),
      );
      const labelBySlug = new Map(SKILLS.map((s) => [s.slug, s.label]));
      orderedRecommendations = applyPrereqOrdering(
        recommendations,
        edges,
        ownedSlugs,
        labelBySlug,
      );
    }
  }

  // ── 6. Compose snapshot ─────────────────────────────────────────────────
  const learningPaths: LearningPath[] = pickRelevantPaths(
    await listAllLearningPaths(),
    orderedRecommendations.map((r) => r.skill.slug),
  );

  const cityDemand = cityDemandRows.map((r) => ({
    skill: titleCase(r.skill),
    searches: r.searches,
    matches: r.matches,
    gap: Math.max(0, r.gap),
  }));

  return {
    headline: {
      currentRank: 0,
      projectedRank: 0,
      poolLabel: `${profile.profession} · ${profile.province}`,
      skillsNeeded: Math.min(
        recommendations.length,
        Math.max(1, 5 - profile.topSkills.length),
      ),
    },
    recommendations: orderedRecommendations,
    learningPaths,
    adjacentProfessions,
    cityDemand,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function loadAdjacentProfessions(
  db: ReturnType<typeof getDb>,
  handle: string,
  ownProfession: string,
): Promise<AdjacentProfession[]> {
  // For each OTHER profession, compute the % of THEIR skills that the
  // seeker already has. ≥40% overlap = a reachable adjacent role.
  const overlapRows = unwrap<{
    profession: string;
    common: number;
    profession_total: number;
  }>(
    await db.execute(sql`
      WITH my_skills AS (
        SELECT skill_slug
        FROM profile_skills
        WHERE profile_id = (SELECT id FROM profiles WHERE handle = ${handle} LIMIT 1)
      ),
      per_profession AS (
        SELECT
          p.profession,
          ps.skill_slug,
          COUNT(*) OVER (PARTITION BY p.profession, ps.skill_slug) AS skill_freq
        FROM profiles p
        JOIN profile_skills ps ON ps.profile_id = p.id
        WHERE p.deleted_at IS NULL
          AND LOWER(p.profession) <> LOWER(${ownProfession})
      ),
      profession_skills AS (
        SELECT
          profession,
          ARRAY_AGG(DISTINCT skill_slug) AS skills,
          COUNT(DISTINCT skill_slug)::int AS profession_total
        FROM per_profession
        GROUP BY profession
      )
      SELECT
        profession,
        (SELECT COUNT(*)::int FROM my_skills ms WHERE ms.skill_slug = ANY(ps.skills)) AS common,
        profession_total
      FROM profession_skills ps
      WHERE profession_total > 0
      ORDER BY common DESC
      LIMIT ${MAX_ADJACENT}
    `),
  );

  const slugByLabel = new Map(PROFESSIONS.map((p) => [p.label, p.slug]));
  const skillLabelBySlug = new Map(SKILLS.map((s) => [s.slug, s.label]));

  // We need the "missing skills" list per profession  one extra query for
  // each row, but capped at MAX_ADJACENT so it's tiny.
  const out: AdjacentProfession[] = [];
  for (const row of overlapRows) {
    if (row.profession_total === 0) continue;
    const overlap = row.common / row.profession_total;
    if (overlap < OVERLAP_THRESHOLD && out.length >= 1) continue; // keep at least 1 even if below threshold

    const missingRows = unwrap<{ skill_slug: string }>(
      await db.execute(sql`
        WITH my_skills AS (
          SELECT skill_slug
          FROM profile_skills
          WHERE profile_id = (SELECT id FROM profiles WHERE handle = ${handle} LIMIT 1)
        )
        SELECT DISTINCT ps.skill_slug
        FROM profile_skills ps
        JOIN profiles p ON p.id = ps.profile_id
        WHERE LOWER(p.profession) = LOWER(${row.profession})
          AND ps.skill_slug NOT IN (SELECT skill_slug FROM my_skills)
        LIMIT 5
      `),
    );
    const missingSkills = missingRows
      .map((r) => skillLabelBySlug.get(r.skill_slug) ?? r.skill_slug)
      .slice(0, 4);

    out.push({
      profession: {
        slug: slugByLabel.get(row.profession) ?? row.profession.toLowerCase(),
        label: row.profession,
      },
      overlap,
      missingSkills,
      demandHint:
        missingSkills.length > 0
          ? `${missingSkills.length} skill${missingSkills.length === 1 ? "" : "s"} away from this role on Sebenza.`
          : undefined,
    });
  }
  return out;
}

// Pick the learning paths that unlock the highest-priority skill gaps.
function pickRelevantPaths(
  catalog: LearningPath[],
  prioritySkillSlugs: string[],
): LearningPath[] {
  if (prioritySkillSlugs.length === 0) return catalog.slice(0, MAX_LEARNING_PATHS);
  const skillLabelBySlug = new Map(SKILLS.map((s) => [s.slug, s.label.toLowerCase()]));
  const priorityLabels = new Set(
    prioritySkillSlugs
      .map((s) => skillLabelBySlug.get(s))
      .filter((l): l is string => !!l),
  );

  // Score each path by how many of its `unlocksSkills` overlap with priority.
  const scored = catalog
    .map((p) => ({
      path: p,
      score: p.unlocksSkills.filter((s) =>
        priorityLabels.has(s.toLowerCase()),
      ).length,
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.path);

  return scored.slice(0, MAX_LEARNING_PATHS);
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 16.1  "Demand near you".
//
// The honest, reverse-matching answer to "work near me": how much EMPLOYER
// demand there is for the seeker's profession in their province (and across
// SA, for the remote line). Reads the SAME `search_events` table + the SAME
// 90-day window the compass demand engine above uses (D5: reuse the engine,
// don't build a parallel one). This is demand-side activity (employer
// searches), never a seeker cohort  so there is no k-anonymity exposure;
// it stays PROVINCE-level by default (D2), never a cross-seeker city
// aggregate.
// ─────────────────────────────────────────────────────────────────────────────

export interface NearYouDemand {
  /** Province label, echoed for the card copy. */
  province: string;
  /** Window the counts cover (days). */
  windowDays: number;
  /** Employer searches for this profession scoped to the seeker's province. */
  localSearches: number;
  /** Employer searches for this profession across all of SA (superset). */
  nationalSearches: number;
}

export async function getNearYouDemand(
  profession: string,
  provinceLabel: string,
): Promise<NearYouDemand> {
  const db = getDb();
  // `search_events.filters->>'province'` is the slug the /search page wrote
  // (e.g. "western-cape"); convert the profile's province LABEL to match.
  const provinceSlug =
    PROVINCES.find(
      (p) => p.label.toLowerCase() === provinceLabel.trim().toLowerCase(),
    )?.slug ?? provinceLabel.trim().toLowerCase().replace(/\s+/g, "-");

  const rows = unwrap<{ local: number; national: number }>(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE filters->>'province' = ${provinceSlug})::int AS local,
        COUNT(*)::int AS national
      FROM search_events
      WHERE at >= now() - (${DEMAND_WINDOW_DAYS} || ' days')::interval
        AND (
          LOWER(COALESCE(terms, '')) LIKE '%' || LOWER(${profession}) || '%'
          OR LOWER(COALESCE(filters->>'query', '')) LIKE '%' || LOWER(${profession}) || '%'
          OR LOWER(COALESCE(filters->>'profession', '')) = LOWER(${profession})
        )
    `),
  );
  const r = rows[0] ?? { local: 0, national: 0 };
  return {
    province: provinceLabel,
    windowDays: DEMAND_WINDOW_DAYS,
    localSearches: r.local,
    nationalSearches: r.national,
  };
}

// Re-export the type so consumers don't import from two places.
export type { CompassSnapshot, TaxonomyEntry };
