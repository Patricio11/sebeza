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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 13.2  module_skills read path.
//
// Surfaces the editorial-catalogue skill inferences for a student's
// declared modules + (when present) elective + project topic. Powers
// the new "Skills inferred from your current modules" section on
// <ProgrammeVsMarketCard>.
//
// Trigram (`pg_trgm`) similarity is the matching primitive  the
// student's free-text module strings rarely match the catalogue
// label exactly. Threshold is the Postgres default
// (`pg_trgm.similarity_threshold`, ~0.3) so "DB Theory" matches
// "Database Theory" but "DB" alone doesn't go wild and pull
// every label.
//
// `llm_suggested` rows are EXCLUDED from the student-facing surface
// until an admin approves them (they appear only on the Task 13.3
// admin review queue). Editorial + student_signal rows ship live.
// ─────────────────────────────────────────────────────────────────────────────

export interface InferredSkillRef {
  slug: string;
  label: string;
  /** 15 editorial confidence (5 = canonical, 1 = weak signal). */
  confidence: number;
  /** Module label (or project/elective text) that surfaced this
   *  skill. Lets the card render "Skills from your 'Database
   *  Systems' module: SQL · PostgreSQL". */
  matchedFrom: string;
}

export interface ModuleSkillsForStudent {
  /** Skills inferred from `academic_profiles.current_modules`. */
  fromModules: InferredSkillRef[];
  /** Skills inferred from `academic_profiles.elective_chosen`. */
  fromElective: InferredSkillRef[];
  /** Skills inferred from `academic_profiles.project_topic`. */
  fromProject: InferredSkillRef[];
}

const EMPTY_STUDENT_SKILLS: ModuleSkillsForStudent = {
  fromModules: [],
  fromElective: [],
  fromProject: [],
};

/**
 * Look up the editorial catalogue inferences for one student. Caller
 * passes the seeker's `profileId`; the function joins through
 * `academic_profiles` to read the three context fields, then runs
 * the trigram match against `module_skills` + (loosely)
 * `skills.label` for the free-text elective + project topic fields.
 *
 * Returns the canonical empty shape when the seeker has no academic
 * row at all (non-students) or when the academic row has no context
 * declared yet (Day-1 student who hasn't filled in modules).
 *
 * Read complexity is bounded: max 8 modules per student + max one
 * elective + max one project, each matched with `LIMIT 5` per
 * source text.
 */
export async function moduleSkillsForStudent(
  profileId: string,
): Promise<ModuleSkillsForStudent> {
  const db = getDb();

  // Pull the three context columns + institution scope in one query
  // so we don't round-trip on a non-student profile.
  const ctx = (
    (await db.execute(sql`
      SELECT current_modules, elective_chosen, project_topic,
             institution_slug
      FROM academic_profiles
      WHERE profile_id = ${profileId}
      LIMIT 1
    `)) as unknown as {
      rows: Array<{
        current_modules: string[] | string | null;
        elective_chosen: string | null;
        project_topic: string | null;
        institution_slug: string | null;
      }>;
    }
  ).rows[0];
  if (!ctx) return EMPTY_STUDENT_SKILLS;

  // `current_modules` returns as a real array on Postgres + as a
  // serialised string (`{Operating Systems,Database Systems}`) on
  // some drivers. Normalise.
  const modules: string[] = Array.isArray(ctx.current_modules)
    ? ctx.current_modules
    : typeof ctx.current_modules === "string"
      ? ctx.current_modules
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .filter((s) => s.length > 0)
      : [];

  const fromModules =
    modules.length > 0
      ? await matchModulesAgainstCatalogue(modules, ctx.institution_slug)
      : [];
  const fromElective = ctx.elective_chosen
    ? await matchFreeTextAgainstSkills(ctx.elective_chosen)
    : [];
  const fromProject = ctx.project_topic
    ? await matchFreeTextAgainstSkills(ctx.project_topic)
    : [];

  return { fromModules, fromElective, fromProject };
}

/**
 * For each declared module string, find the catalogue rows whose
 * `module_label` is trigram-similar. Prefer institution-scoped rows
 * over canonical when both exist. Cap to 5 skills per module so a
 * particularly chatty editorial row can't blow up the result set.
 */
async function matchModulesAgainstCatalogue(
  modules: string[],
  institutionSlug: string | null,
): Promise<InferredSkillRef[]> {
  const db = getDb();

  // Bind the array as a Postgres text[] literal. Drizzle's `sql` tag
  // serialises JS arrays correctly for parameter binding; explicit
  // cast keeps the planner honest when the array is empty.
  const out: InferredSkillRef[] = [];
  for (const moduleText of modules) {
    if (!moduleText || moduleText.trim().length === 0) continue;
    const rows = (
      (await db.execute(sql`
        SELECT DISTINCT ON (ms.skill_slug)
          ms.module_label  AS matched_from,
          ms.skill_slug,
          s.label          AS skill_label,
          ms.confidence,
          ms.institution_slug
        FROM module_skills ms
        INNER JOIN skills s ON s.slug = ms.skill_slug
        WHERE ms.source = 'editorial'
          AND ms.module_label % ${moduleText}
          AND (ms.institution_slug IS NULL
               OR ms.institution_slug = ${institutionSlug ?? null})
        ORDER BY ms.skill_slug,
          -- Prefer institution-scoped rows over canonical.
          (CASE WHEN ms.institution_slug = ${institutionSlug ?? null}
                THEN 0 ELSE 1 END),
          ms.confidence DESC
        LIMIT 5
      `)) as unknown as {
        rows: Array<{
          matched_from: string;
          skill_slug: string;
          skill_label: string;
          confidence: number;
        }>;
      }
    ).rows;
    for (const r of rows) {
      out.push({
        slug: r.skill_slug,
        label: r.skill_label,
        confidence: r.confidence,
        matchedFrom: r.matched_from,
      });
    }
  }
  // De-dupe across modules  if "Database Systems" + "Databases"
  // both surface SQL, we only want one chip on the card.
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });
}

/**
 * Match a single free-text string (the elective name or project
 * topic) against `skills.label` via trigram similarity. Caps to 5
 * hits so a vague phrase ("research methods") can't surface a wall
 * of weak matches.
 *
 * Note on quality: the SKILLS taxonomy today is job-skills-focused
 * (React, AWS, SAIPA). Free-text from a third-year project topic
 * will surface few hits until either (a) the taxonomy grows or
 * (b) a `skill_synonyms` enrichment table lands. We ship the
 * function with that honest limitation; the editorial catalogue
 * pathway through `matchModulesAgainstCatalogue` is the load-bearing
 * one for now.
 */
async function matchFreeTextAgainstSkills(
  text: string,
): Promise<InferredSkillRef[]> {
  const db = getDb();
  const trimmed = text.trim();
  if (trimmed.length < 3) return [];
  const rows = (
    (await db.execute(sql`
      SELECT
        s.slug,
        s.label,
        similarity(s.label, ${trimmed}) AS score
      FROM skills s
      WHERE s.label % ${trimmed}
      ORDER BY score DESC
      LIMIT 5
    `)) as unknown as {
      rows: Array<{ slug: string; label: string; score: string }>;
    }
  ).rows;
  return rows.map((r) => ({
    slug: r.slug,
    label: r.label,
    // Convert pg_trgm similarity (0..1) into the 1..5 confidence
    // band so the card renders a stable indicator. similarity >= 0.6
    // is a strong match; 0.30.5 is weak.
    confidence: Number(r.score) >= 0.6 ? 4 : Number(r.score) >= 0.45 ? 3 : 2,
    matchedFrom: trimmed,
  }));
}
