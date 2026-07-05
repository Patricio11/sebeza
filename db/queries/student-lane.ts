/**
 * Phase 23.1 ("Truth & Data Integrity")  the DB-backed student lane.
 *
 * Replaces the runtime read of the hardcoded `getStudentSnapshot()` mock with a
 * snapshot assembled entirely from live signals, keeping the exact
 * `StudentSnapshot` shape the `StudentLane` renderer already consumes:
 *
 *   - graduationHeadline  computed from the seeker's own expectedGraduation.
 *   - electives           the programme's REAL curriculum-vs-demand cells
 *                         (programme_skills × search_events, 9.13) that the
 *                         curriculum covers, ranked by live demand; matches
 *                         counted from profile_skills (same definition the
 *                         compass uses). No cells → section hidden.
 *   - programmes          the `graduate_programmes` table (seeded, editable),
 *                         field-tag matched, public sector listed first.
 *   - destinations        REAL confirmed placements of consented graduates of
 *                         the same programme × institution  k-floor
 *                         suppressed (outcomes_min_cohort_size); below the
 *                         floor → [] → section hidden. "From confirmed
 *                         placements" is finally true.
 *   - supplementarySkills the seeker's live compass recommendations.
 */

import "server-only";
import { asc, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";
import { monthsUntil } from "@/lib/mock/academic";
import type {
  StudentSnapshot,
  OpportunityProgramme,
  GraduateDestination,
  ProgrammeElective,
} from "@/lib/mock/academic";
import type { AcademicProfile } from "@/lib/mock/types";
import type { CurriculumResult } from "@/db/queries/curriculum";
import type { SkillRecommendation } from "@/lib/mock/growth";

const MAX_ELECTIVES = 3;
const MAX_PROGRAMMES = 5;
const MAX_DESTINATIONS = 7;
const MAX_SUPPLEMENTARY = 3;

/** Field-tag match: tag ⊆ fieldOfStudy or fieldOfStudy ⊆ tag, case-insensitive. */
function fieldMatches(fieldOfStudy: string, tags: string[]): boolean {
  const f = fieldOfStudy.trim().toLowerCase();
  if (f.length === 0) return false;
  return tags.some((t) => {
    const tag = t.trim().toLowerCase();
    return tag.includes(f) || f.includes(tag);
  });
}

async function listProgrammesForField(
  fieldOfStudy: string,
): Promise<OpportunityProgramme[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.graduateProgrammes)
    .where(isNull(schema.graduateProgrammes.deletedAt))
    .orderBy(
      asc(schema.graduateProgrammes.sortOrder),
      asc(schema.graduateProgrammes.id),
    );
  return rows
    .filter((r) => fieldMatches(fieldOfStudy, r.fieldTags))
    .sort((a, b) => {
      // Public sector listed first (the original honesty/visibility rule).
      const ap = a.sector === "public" ? 0 : 1;
      const bp = b.sector === "public" ? 0 : 1;
      return ap - bp || a.sortOrder - b.sortOrder;
    })
    .slice(0, MAX_PROGRAMMES)
    .map((r) => ({
      title: r.title,
      organisation: r.organisation,
      sector: r.sector as OpportunityProgramme["sector"],
      kind: r.kind as OpportunityProgramme["kind"],
      durationMonths: r.durationMonths,
      cities: r.cities,
      applicationStatus:
        r.applicationStatus as OpportunityProgramme["applicationStatus"],
      applicationHint: r.applicationHint,
      eligibility: r.eligibility,
      fieldTags: r.fieldTags,
      saqaRecognised: r.saqaRecognised,
    }));
}

/**
 * Real graduate destinations for a programme × institution: employer-confirmed
 * placements of consented (outcomes_research) graduates, grouped by placement
 * role. k-floor on the placed cohort; below it → [] (section hides  we never
 * fabricate a distribution).
 */
async function getDestinations(
  programme: string,
  institutionSlug: string,
): Promise<GraduateDestination[]> {
  const db = getDb();
  const k = await getSetting<number>("outcomes_min_cohort_size");

  const result = await db.execute(sql`
    WITH cohort AS (
      SELECT p.id AS profile_id, p.member_since
      FROM profiles p
      INNER JOIN academic_profiles ap ON ap.profile_id = p.id
      INNER JOIN consents c
        ON c.user_id = p.user_id
       AND c.purpose = 'outcomes_research'
       AND c.state = 'granted'
      WHERE p.deleted_at IS NULL
        AND LOWER(ap.programme) = LOWER(${programme})
        AND ap.institution_slug = ${institutionSlug}
    ),
    placed AS (
      SELECT
        pl.role,
        EXTRACT(EPOCH FROM (pl.hired_at - co.member_since)) / 2592000.0 AS months_to_hire
      FROM cohort co
      INNER JOIN placements pl
        ON pl.profile_id = co.profile_id
       AND pl.source = 'employer_confirmed'
    )
    SELECT
      role AS destination,
      COUNT(*)::int AS n,
      (SELECT COUNT(*)::int FROM placed) AS total,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY months_to_hire) AS median_months
    FROM placed
    GROUP BY role
    ORDER BY n DESC, role ASC
    LIMIT ${MAX_DESTINATIONS}
  `);
  const rows = (
    result as unknown as {
      rows: Array<{
        destination: string;
        n: number;
        total: number;
        median_months: number | null;
      }>;
    }
  ).rows;

  const total = rows[0]?.total ?? 0;
  if (total < k) return []; // below the floor  hide, never fabricate

  return rows.map((r) => ({
    destination: r.destination,
    share: total > 0 ? r.n / total : 0,
    medianMonthsToPlacement:
      r.median_months == null ? null : Math.max(1, Math.round(r.median_months)),
  }));
}

/**
 * Electives from the REAL curriculum-vs-demand result the page already loads:
 * skills the programme covers (in_programme = true), ranked by live demand.
 * `matches` = seekers carrying the skill (same definition as the compass).
 */
async function buildElectives(
  curriculum: CurriculumResult | null,
  programme: string,
  institutionLabel: string,
): Promise<ProgrammeElective[]> {
  if (!curriculum) return [];
  const covered = curriculum.cells
    .filter((c) => c.in_programme && c.demand_score > 0)
    .sort((a, b) => b.demand_score - a.demand_score)
    .slice(0, MAX_ELECTIVES);
  if (covered.length === 0) return [];

  const db = getDb();
  const slugs = covered.map((c) => c.skill_slug);
  const matchResult = await db.execute(sql`
    SELECT skill_slug, COUNT(*)::int AS matches
    FROM profile_skills
    WHERE skill_slug = ANY(${slugs})
    GROUP BY skill_slug
  `);
  const matchBySlug = new Map(
    (
      matchResult as unknown as {
        rows: Array<{ skill_slug: string; matches: number }>;
      }
    ).rows.map((r) => [r.skill_slug, r.matches]),
  );

  return covered.map((c) => ({
    skill: { slug: c.skill_slug, label: c.skill_label },
    curriculumHint: `${programme} · ${institutionLabel}`,
    detail: `${c.demand_score} employer search${
      c.demand_score === 1 ? "" : "es"
    } in the last 90 days mention this skill  and your programme's curriculum covers it. Prioritising it before graduation is real leverage.`,
    demandSignal: {
      searches: c.demand_score,
      matches: matchBySlug.get(c.skill_slug) ?? 0,
    },
  }));
}

/** Assemble the live StudentSnapshot. Same shape the renderer always used. */
export async function buildStudentSnapshot(opts: {
  academic: AcademicProfile;
  curriculum: CurriculumResult | null;
  recommendations: SkillRecommendation[];
}): Promise<StudentSnapshot> {
  const { academic } = opts;
  const [electives, programmes, destinations] = await Promise.all([
    buildElectives(opts.curriculum, academic.programme, academic.institutionLabel),
    listProgrammesForField(academic.fieldOfStudy),
    getDestinations(academic.programme, academic.institutionSlug),
  ]);

  return {
    graduationHeadline: {
      monthsLeft: monthsUntil(academic.expectedGraduation),
      expectedGraduation: academic.expectedGraduation,
    },
    bridgeHeadline: `Your ${academic.programme} gives you the fundamentals  this is the live market signal to bridge before graduation.`,
    electives,
    programmes,
    destinations,
    supplementarySkills: opts.recommendations
      .slice(0, MAX_SUPPLEMENTARY)
      .map((r) => ({ slug: r.skill.slug, label: r.skill.label })),
  };
}
