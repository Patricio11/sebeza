/**
 * Phase 9.13.3  Demand-vs-curriculum analytics.
 *
 * Joins `programme_skills` (the hand-curated D4 mapping) against
 * recent search demand (`search_events`, 90-day window via ILIKE on
 * skill labels, mirrors `career-compass.ts`) to surface "what does
 * the labour market want vs what this programme covers" per
 * (programme × institution × province) cell.
 *
 * Two callers, one function:
 *
 *   1. **Student-side** (`/dashboard/grow` student lane): pass
 *      `institutionSlug` + `programme` + the student's province. NO
 *      consent gate (it's their own programme's curriculum, public);
 *      NO suppression (single-cell view  the seeker is asking for
 *      their own context). Below-floor cells still render honestly
 *      with the "limited data so far" empty state.
 *
 *   2. **Gov-facing cross-market** (`/gov/curriculum`): omit the
 *      institution/programme + apply `outcomes_research` consent gate
 *      (D1) + run through `suppress()` (D2). Per-(programme ×
 *      institution × province) cells; below k=10 are dropped + the
 *      complementary axes catch reconstruction by subtraction.
 *
 * Freshness: per D6, the demand side reuses
 * `sebenza_freshness_confidence(at)` on the search_events
 * timestamp  recent searches dominate (same engine 9.7 + 9.8.7 use).
 *
 * Per D5 (the sister-decision in 9.13): no provider dimension here
 * (the dataset is about WHAT is taught, not WHO teaches it). Provider
 * judgment lives in vendor reviews, not policy intelligence.
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { suppress, type SuppressionAxis } from "@/lib/analytics/suppress";
import { SKILLS } from "@/lib/mock/taxonomy";

const DEMAND_WINDOW_DAYS = 90;

export interface CurriculumCell {
  institution_slug: string;
  programme: string;
  province_slug: string;
  skill_slug: string;
  skill_label: string;
  weight: number;
  /** Recent searches mentioning this skill (`search_events` 90d). */
  demand_score: number;
  /** Freshness 0..1 (1 = today, 0.25 = ~2 years ago). */
  freshness: number;
  /**
   * True when `programme_skills` has a row for this (programme ×
   * institution × skill)  i.e. the programme's curriculum covers it.
   * False = market wants it, the programme doesn't (the gap signal).
   */
  in_programme: boolean;
}

export interface CurriculumResult {
  cells: CurriculumCell[];
  k: number;
  suppressed: number;
  /** True when the result is scoped to one programme  no suppression. */
  studentScope: boolean;
  /** Programme rows we know about (for the gov-side dropdown +
   *  student-side "your programme" label). */
  programmeOptions: Array<{
    institutionSlug: string;
    institutionLabel: string;
    programme: string;
  }>;
}

// Gov-facing complementary suppression. Two passes per the 9.8.7 idiom:
//   1. Within (institution × programme)  one surviving skill +
//      suppressed siblings → recoverable, drop.
//   2. Within (skill × province)  one surviving institution +
//      suppressed siblings → recoverable, drop.
const CURRICULUM_AXES: SuppressionAxis<CurriculumCell>[] = [
  {
    groupBy: ["institution_slug", "programme"],
    complementOver: "skill_slug",
  },
  {
    groupBy: ["skill_slug", "province_slug"],
    complementOver: "institution_slug",
  },
];

export interface CurriculumQueryArgs {
  /** Student-side scope. Pass all three for the focused view. */
  institutionSlug?: string;
  programme?: string;
  provinceSlug?: string;
}

export async function demandVsCurriculumQuery(
  args: CurriculumQueryArgs = {},
): Promise<CurriculumResult> {
  const db = getDb();
  const k = await getSetting<number>("outcomes_min_cohort_size");
  const studentScope = !!(args.institutionSlug && args.programme);

  // 1. Recent demand per skill from search_events. Same approach as
  //    career-compass.ts: ILIKE match against skill labels.
  const demandRows = (
    (await db.execute(sql`
      WITH recent_searches AS (
        SELECT LOWER(terms) AS term, at
        FROM search_events
        WHERE terms IS NOT NULL
          AND length(terms) >= 2
          AND at >= now() - (${DEMAND_WINDOW_DAYS} || ' days')::interval
      )
      SELECT
        s.slug AS skill_slug,
        s.label AS skill_label,
        COUNT(rs.term)::int AS demand_score,
        COALESCE(AVG(sebenza_freshness_confidence(rs.at)), 0)::numeric AS freshness
      FROM skills s
      LEFT JOIN recent_searches rs
        ON rs.term LIKE '%' || LOWER(s.label) || '%'
      GROUP BY s.slug, s.label
    `)) as unknown as {
      rows: Array<{
        skill_slug: string;
        skill_label: string;
        demand_score: number;
        freshness: string;
      }>;
    }
  ).rows;
  const demandBySkill = new Map(
    demandRows.map((d) => ({
      ...d,
      freshness: Number(d.freshness),
    })).map((d) => [d.skill_slug, d]),
  );

  // 2. The programme_skills mapping (optionally filtered).
  const programmeFilter = studentScope
    ? sql`AND ps.institution_slug = ${args.institutionSlug} AND ps.programme = ${args.programme}`
    : sql``;
  const programmeRows = (
    (await db.execute(sql`
      SELECT
        ps.institution_slug,
        ps.programme,
        ps.skill_slug,
        ps.weight,
        i.province_slug
      FROM programme_skills ps
      INNER JOIN institutions i ON i.slug = ps.institution_slug
      WHERE 1=1
        ${programmeFilter}
      ORDER BY ps.institution_slug, ps.programme, ps.weight DESC
    `)) as unknown as {
      rows: Array<{
        institution_slug: string;
        programme: string;
        skill_slug: string;
        weight: number;
        province_slug: string;
      }>;
    }
  ).rows;

  // 3. Programme options for the dropdown (always returned).
  const programmeOptionsRaw = (
    (await db.execute(sql`
      SELECT DISTINCT ps.institution_slug, ps.programme, i.label AS institution_label
      FROM programme_skills ps
      INNER JOIN institutions i ON i.slug = ps.institution_slug
      ORDER BY i.label, ps.programme
    `)) as unknown as {
      rows: Array<{
        institution_slug: string;
        programme: string;
        institution_label: string;
      }>;
    }
  ).rows;
  const programmeOptions = programmeOptionsRaw.map((r) => ({
    institutionSlug: r.institution_slug,
    institutionLabel: r.institution_label,
    programme: r.programme,
  }));

  const labelBySlug = new Map(SKILLS.map((s) => [s.slug, s.label]));

  // 4. Build cells. Each programme contributes (a) one row per skill
  //    it covers (`in_programme: true`) + (b) the top in-demand skills
  //    it does NOT cover (`in_programme: false`)  the gap signal.
  const all: CurriculumCell[] = [];

  // Group programme_rows by (institution, programme) so we can
  // compute the "what's in" + "what's missing" set per programme.
  const programmes = new Map<
    string,
    {
      institutionSlug: string;
      programme: string;
      provinceSlug: string;
      coveredSkills: Set<string>;
      rows: typeof programmeRows;
    }
  >();
  for (const r of programmeRows) {
    const key = `${r.institution_slug}::${r.programme}`;
    const existing = programmes.get(key);
    if (existing) {
      existing.coveredSkills.add(r.skill_slug);
      existing.rows.push(r);
    } else {
      programmes.set(key, {
        institutionSlug: r.institution_slug,
        programme: r.programme,
        provinceSlug: r.province_slug,
        coveredSkills: new Set([r.skill_slug]),
        rows: [r],
      });
    }
  }

  // Top in-demand skills overall  used to compute the "missing"
  // contributions per programme. Capped so we don't render a row per
  // skill in the catalog.
  const TOP_DEMAND = Array.from(demandBySkill.values())
    .filter((d) => d.demand_score > 0)
    .sort((a, b) => b.demand_score - a.demand_score)
    .slice(0, 10);

  for (const p of programmes.values()) {
    // Covered skills  one row each (in_programme: true).
    for (const r of p.rows) {
      const demand = demandBySkill.get(r.skill_slug);
      all.push({
        institution_slug: r.institution_slug,
        programme: r.programme,
        province_slug: r.province_slug,
        skill_slug: r.skill_slug,
        skill_label: labelBySlug.get(r.skill_slug) ?? r.skill_slug,
        weight: r.weight,
        demand_score: demand?.demand_score ?? 0,
        freshness: demand?.freshness ?? 0,
        in_programme: true,
      });
    }
    // Top in-demand skills the programme does NOT cover (the gap).
    for (const d of TOP_DEMAND) {
      if (p.coveredSkills.has(d.skill_slug)) continue;
      all.push({
        institution_slug: p.institutionSlug,
        programme: p.programme,
        province_slug: p.provinceSlug,
        skill_slug: d.skill_slug,
        skill_label: d.skill_label,
        weight: 0,
        demand_score: d.demand_score,
        freshness: d.freshness,
        in_programme: false,
      });
    }
  }

  // 5. Student-scope returns full data, no suppression (single
  //    programme view; suppression of a single-programme view is
  //    incoherent + the seeker is already authorized to see their own
  //    programme).
  if (studentScope) {
    return {
      cells: all,
      k,
      suppressed: 0,
      studentScope: true,
      programmeOptions,
    };
  }

  // 6. Gov-scope: suppress() + the two complementary passes.
  //    Count proxy: each cell's `demand_score` acts as the cohort
  //    count (since the cell represents "X recent searches matched
  //    this skill in the labour market within this programme's
  //    province scope"). Cells with demand_score < k are dropped.
  //    Below-floor cells include the "no signal yet" ones, which is
  //    correct  empty state honestly conveys "we don't have enough
  //    market signal in this cell yet."
  const { passed, suppressedCount } = suppress(all, {
    countKey: "demand_score",
    k,
    axes: CURRICULUM_AXES,
  });

  return {
    cells: passed,
    k,
    suppressed: suppressedCount,
    studentScope: false,
    programmeOptions,
  };
}
