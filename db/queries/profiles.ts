/**
 * Phase 4  Postgres-backed profile queries.
 *
 * Every function here is the **canonical public read path**. The shape we
 * return is `PublicProfile` (with `profilePhotoUrl` as a raw storage key 
 * the dbProvider wrapper signs it before handing to consumers).
 *
 * Redaction Rule (`docs/SECURITY.md`): every SELECT here enumerates the
 * exact columns we want. `nationalIdEnc`, `fullSurname`, `searchVector`,
 * and `email` are NEVER selected on a public read.
 *
 * Search SQL composes a per-row score as:
 *   relevance × freshness_confidence × completeness
 *
 * When the "highlight SA citizens" filter is ON, the result list is
 * additionally hard-grouped: every SA citizen ranks above every
 * non-citizen (regardless of score) and within each group the score
 * above orders rows. This is a deliberate UX choice  the toggle
 * promises "South Africans first," not "South Africans slightly
 * boosted." See `citizenGroupKey` below.
 */

import "server-only";
import { sql, eq, desc, asc, and, isNull, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { logAccess } from "@/lib/audit";
import type {
  PublicProfile,
  SearchFilters,
  Seniority,
  VerificationStatus,
  EmploymentStatus,
  SkillRef,
  ExperienceItem,
  QualificationItem,
  AcademicProfile,
  WorkAvailabilityKind,
} from "@/lib/mock/types";
import { INSTITUTIONS, PROVINCES } from "@/lib/mock/taxonomy";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_LIMIT = 50;

/**
 * Parse a Postgres array literal coming back from a raw `db.execute()`
 * call. The Neon HTTP driver auto-decodes built-in array types (e.g.
 * `text[]`), but custom-enum arrays like `work_availability_kind[]`
 * come back as the literal string  e.g. `'{casual,part_time}'` or
 * `'{}'` for an empty array. Drizzle's typed `db.select()` path runs
 * the right column mappers; raw execute does not.
 *
 * The enum values themselves are plain identifiers (no commas, no
 * quoting), so a naive split-on-comma is correct.
 */
function parsePgEnumArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return [];
  const inner = trimmed.slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

export interface SearchResultRow extends PublicProfile {
  /** Score is exposed for debug / display but not part of the canonical type. */
  score: number;
}

/**
 * Search profiles with the ranking SQL. Always writes a `search_events` row
 * (the skills-gap signal Phase 6 analytics builds on).
 *
 * Ranking factors:
 *   ts_rank_cd (when there's a free-text query) × freshness × completeness ×
 *   optional citizen_highlight boost. Stale profiles fall honestly.
 *
 * `profilePhotoUrl` on the returned rows carries the raw storage KEY (not a
 * signed URL). The dbProvider wrapper signs it once it has the row.
 */
export async function searchProfilesQuery(
  filters: SearchFilters,
): Promise<{ total: number; profiles: SearchResultRow[] }> {
  const db = getDb();
  const q = (filters.query ?? "").trim();
  const hasQuery = q.length > 0;

  // The ranking expression. When there's no query, ts_rank_cd would be 0 for
  // all rows and the WHERE @@ clause would match nothing  so we branch.
  const rankExpr = hasQuery
    ? sql`ts_rank_cd(p.search_vector, websearch_to_tsquery('simple', ${q}))`
    : sql`1.0::numeric`;

  // When the "highlight SA citizens" filter is ON, hard-group SA citizens
  // ABOVE non-citizens in the result list rather than just nudging them up
  // by a multiplier. This is the explicit user expectation (2026-05-25):
  // the toggle should produce a visible "all SA first, then everyone else"
  // ordering, not a soft boost where a stronger non-citizen match can still
  // outrank a weaker SA citizen. Inside each group we still sort by the
  // composed score below, so the best SA citizen is on top, then the rest
  // of the SA citizens by score, then the best non-citizen, etc.
  //
  // We DON'T also apply a score multiplier  the hard grouping is the
  // canonical signal now, and stacking both would distort the within-group
  // ordering without changing the user-visible result.
  const citizenGroupKey = filters.highlightCitizens
    ? sql`CASE WHEN p.is_citizen THEN 0 ELSE 1 END`
    : sql`0`;

  // WHERE clauses  assembled conditionally so a missing filter doesn't
  // narrow the result set.
  const conditions = [sql`p.deleted_at IS NULL`];

  if (hasQuery) {
    // FTS match. We use websearch_to_tsquery so users can type natural-looking
    // queries (e.g. `"senior developer" -junior`).
    conditions.push(
      sql`p.search_vector @@ websearch_to_tsquery('simple', ${q})`,
    );
  }
  if (filters.province) {
    // Filters arrive as slugs (e.g. "western-cape", "kwazulu-natal") but
    // the column stores the human label ("Western Cape", "KwaZulu-Natal").
    // Use the PROVINCES taxonomy as the canonical map  the naive
    // `.replace(/-/g, " ")` transform broke for KwaZulu-Natal whose name
    // legitimately contains a hyphen ("kwazulu natal" matched nothing).
    const canonical = PROVINCES.find(
      (p) =>
        p.slug === filters.province ||
        p.label.toLowerCase() === filters.province?.toLowerCase(),
    );
    if (canonical) {
      conditions.push(sql`lower(p.province) = lower(${canonical.label})`);
    } else {
      // Unknown slug  fall back to the old behaviour so we don't
      // silently widen the result set.
      const fallback = filters.province.replace(/-/g, " ");
      conditions.push(sql`lower(p.province) = lower(${fallback})`);
    }
  }
  if (filters.profession) {
    // Exact profession-label filter (case-insensitive). Used by the
    // /insights heatmap deep-link; complementary to the FTS `query`
    // path. Both can be active simultaneously  the heatmap link
    // passes profession only, leaving free-text empty.
    conditions.push(sql`lower(p.profession) = lower(${filters.profession})`);
  }
  if (filters.city) {
    const label = filters.city.replace(/-/g, " ");
    conditions.push(sql`lower(p.city) = lower(${label})`);
  }
  if (filters.status) {
    conditions.push(sql`p.status = ${filters.status}`);
  }
  if (filters.seniority) {
    conditions.push(sql`p.seniority = ${filters.seniority}`);
  }
  if (filters.verification) {
    conditions.push(sql`p.verification = ${filters.verification}`);
  }
  if (filters.openToInternships) {
    // EXISTS-join against academic_profiles. We use EXISTS (not INNER JOIN)
    // so the parent select-list redaction stays clean.
    conditions.push(
      sql`EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.open_to_internships = true)`,
    );
  }
  if (filters.openToGraduateProgrammes) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.open_to_graduate_programmes = true)`,
    );
  }
  // Phase 7.5  multi-select work-availability filter. Empty array
  // (or absent) means no filter. The `&&` operator is array overlap:
  // a profile matches if ANY of its availability kinds is in the
  // requested set. Backed by the GIN index on `work_availability`.
  if (filters.availableFor && filters.availableFor.length > 0) {
    const kindsLiteral = sql.raw(
      `ARRAY[${filters.availableFor
        .map((k) => `'${k.replace(/'/g, "''")}'`)
        .join(",")}]::work_availability_kind[]`,
    );
    conditions.push(sql`p.work_availability && ${kindsLiteral}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  // Single query: enumerated columns (redaction!), composed score, ordered.
  // Note: `national_id_enc`, `full_surname`, `search_vector`, `email`,
  // `deleted_at` are intentionally NOT in this select list.
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.handle,
      p.display_name,
      p.profile_photo_url,
      p.profession,
      p.seniority,
      p.city,
      p.province,
      p.nationality,
      p.is_citizen,
      p.bio,
      p.status,
      p.status_confirmed_at,
      p.work_availability,
      p.verification,
      p.completeness,
      p.years_experience,
      p.member_since,
      (
        ${rankExpr}
        * sebenza_freshness_confidence(p.status_confirmed_at)
        * (0.5 + 0.5 * (p.completeness::numeric / 100))
      ) AS score,
      ${citizenGroupKey} AS citizen_group
    FROM profiles p
    WHERE ${whereClause}
    ORDER BY citizen_group ASC, score DESC NULLS LAST, p.completeness DESC
    LIMIT ${SEARCH_LIMIT}
  `);
  // Neon's raw `execute()` returns timestamp columns as ISO strings, not
  // Date objects (the typed `db.select()` path applies Drizzle column
  // mappers; raw execute skips them). Custom-enum arrays
  // (work_availability_kind[]) come back as PG array literal strings
  // (e.g. `{casual,part_time}`), not parsed JS arrays. Normalise both
  // through helpers below.
  const rows = (result as unknown as { rows: Array<{
    id: string;
    handle: string;
    display_name: string;
    profile_photo_url: string | null;
    profession: string;
    seniority: string | null;
    city: string;
    province: string;
    nationality: string | null;
    is_citizen: boolean;
    bio: string | null;
    status: string;
    status_confirmed_at: string | Date;
    work_availability: string[] | string | null;
    verification: string;
    completeness: number;
    years_experience: number | null;
    member_since: string | Date;
    score: string;
  }> }).rows;

  // Pull top-skills for the matched profiles in one extra query.
  // We bound the list (max 5 per profile, in proficiency order) to keep the
  // payload light  public/search reads don't need every skill.
  const ids = rows.map((r) => r.id);
  const skillsByProfile = ids.length > 0 ? await topSkillsByProfile(ids) : new Map();

  const profiles: SearchResultRow[] = rows.map((r) => ({
    handle: r.handle,
    displayName: r.display_name,
    profilePhotoUrl: r.profile_photo_url, // raw key; signed by dbProvider
    profession: r.profession,
    seniority: (r.seniority as Seniority | null) ?? null,
    city: r.city,
    province: r.province,
    nationality: r.nationality,
    isCitizen: r.is_citizen,
    bio: r.bio ?? undefined,
    status: r.status as EmploymentStatus,
    statusConfirmedAt: new Date(r.status_confirmed_at).toISOString(),
    workAvailability: parsePgEnumArray(r.work_availability) as WorkAvailabilityKind[],
    verification: r.verification as VerificationStatus,
    completeness: r.completeness,
    yearsExperience: r.years_experience,
    memberSince: new Date(r.member_since).toISOString(),
    topSkills: skillsByProfile.get(r.id) ?? [],
    score: Number(r.score),
  }));

  // Skills-gap signal  every search writes a row. Phase 6 builds on this.
  // Best-effort: write must not block the response.
  try {
    await db.insert(schema.searchEvents).values({
      id: `srch_${randomUUID()}`,
      terms: q || null,
      filters: filters as unknown as Record<string, unknown>,
      resultCount: profiles.length,
      actorOrgId: null, // set in Phase 5 when employer reveal flow lands
    });
  } catch {
    // Search analytics drift is acceptable; never break the request path.
  }

  await logAccess({
    kind: "search.profiles",
    actor: "anonymous",
    meta: { filters: filters as unknown as Record<string, unknown>, resultCount: profiles.length },
  });

  return { total: profiles.length, profiles };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.8.2  citizenship-bucketed match count
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns counts of matching profiles bucketed by `is_citizen`, used by the
 * vacancy match view's "honest supply line" ("N SA citizens · M total
 * candidates match this vacancy").
 *
 * Mirrors the WHERE-clause assembly of `searchProfilesQuery` exactly so the
 * count is consistent with what the ranked list returns; the only differences
 * are (1) no ranking expression, (2) no LIMIT, (3) we don't write a
 * search_events row from this path (the page's ranked-search call already
 * wrote one). Honest-supply at any data scale, regardless of SEARCH_LIMIT.
 */
export async function countMatchesByCitizenship(
  filters: SearchFilters,
): Promise<{ saCitizen: number; foreignNational: number; total: number }> {
  const db = getDb();
  const q = (filters.query ?? "").trim();
  const hasQuery = q.length > 0;

  const conditions = [sql`p.deleted_at IS NULL`];
  if (hasQuery) {
    conditions.push(
      sql`p.search_vector @@ websearch_to_tsquery('simple', ${q})`,
    );
  }
  if (filters.province) {
    const label = filters.province.replace(/-/g, " ");
    conditions.push(sql`lower(p.province) = lower(${label})`);
  }
  if (filters.city) {
    const label = filters.city.replace(/-/g, " ");
    conditions.push(sql`lower(p.city) = lower(${label})`);
  }
  if (filters.status) {
    conditions.push(sql`p.status = ${filters.status}`);
  }
  if (filters.seniority) {
    conditions.push(sql`p.seniority = ${filters.seniority}`);
  }
  if (filters.verification) {
    conditions.push(sql`p.verification = ${filters.verification}`);
  }
  if (filters.openToInternships) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.open_to_internships = true)`,
    );
  }
  if (filters.openToGraduateProgrammes) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.open_to_graduate_programmes = true)`,
    );
  }
  if (filters.availableFor && filters.availableFor.length > 0) {
    const kindsLiteral = sql.raw(
      `ARRAY[${filters.availableFor
        .map((k) => `'${k.replace(/'/g, "''")}'`)
        .join(",")}]::work_availability_kind[]`,
    );
    conditions.push(sql`p.work_availability && ${kindsLiteral}`);
  }
  const whereClause = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int                                            AS total,
      COUNT(*) FILTER (WHERE p.is_citizen = true)::int         AS sa_citizen,
      COUNT(*) FILTER (WHERE p.is_citizen = false)::int        AS foreign_national
    FROM profiles p
    WHERE ${whereClause}
  `);
  const row = (
    result as unknown as {
      rows: Array<{
        total: number;
        sa_citizen: number;
        foreign_national: number;
      }>;
    }
  ).rows[0]!;
  return {
    total: row.total,
    saCitizen: row.sa_citizen,
    foreignNational: row.foreign_national,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public profile read by handle
// ─────────────────────────────────────────────────────────────────────────────

export async function findProfileByHandleQuery(
  handle: string,
): Promise<PublicProfile | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.profiles.id,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      profilePhotoUrl: schema.profiles.profilePhotoUrl,
      profession: schema.profiles.profession,
      seniority: schema.profiles.seniority,
      city: schema.profiles.city,
      province: schema.profiles.province,
      nationality: schema.profiles.nationality,
      isCitizen: schema.profiles.isCitizen,
      bio: schema.profiles.bio,
      status: schema.profiles.status,
      statusConfirmedAt: schema.profiles.statusConfirmedAt,
      workAvailability: schema.profiles.workAvailability,
      verification: schema.profiles.verification,
      completeness: schema.profiles.completeness,
      yearsExperience: schema.profiles.yearsExperience,
      memberSince: schema.profiles.memberSince,
    })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.handle, handle), isNull(schema.profiles.deletedAt)))
    .limit(1);

  const p = rows[0];
  if (!p) return null;

  const [topSkills, experience, qualifications, academic] = await Promise.all([
    loadTopSkills(p.id),
    loadExperience(p.id),
    loadQualifications(p.id),
    loadAcademic(p.id),
  ]);

  await logAccess({
    kind: "profile.view",
    actor: "anonymous",
    subject: handle,
  });

  return {
    handle: p.handle,
    displayName: p.displayName,
    profilePhotoUrl: p.profilePhotoUrl, // raw key; dbProvider signs
    profession: p.profession,
    seniority: (p.seniority as Seniority | null) ?? null,
    city: p.city,
    province: p.province,
    nationality: p.nationality,
    isCitizen: p.isCitizen,
    bio: p.bio ?? undefined,
    status: p.status as EmploymentStatus,
    statusConfirmedAt: p.statusConfirmedAt.toISOString(),
    workAvailability: (p.workAvailability ?? []) as WorkAvailabilityKind[],
    verification: p.verification as VerificationStatus,
    completeness: p.completeness,
    yearsExperience: p.yearsExperience,
    memberSince: p.memberSince.toISOString(),
    topSkills,
    experience,
    qualifications,
    academic,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent profiles (landing trust strip)
// ─────────────────────────────────────────────────────────────────────────────

export async function recentProfilesQuery(limit = 6): Promise<PublicProfile[]> {
  const { profiles } = await searchProfilesQuery({});
  // searchProfilesQuery already ranks by score + completeness; just trim.
  return profiles.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers  child-table loaders
// ─────────────────────────────────────────────────────────────────────────────

async function loadTopSkills(profileId: string): Promise<SkillRef[]> {
  const db = getDb();
  const rows = await db
    .select({
      label: schema.skills.label,
      proficiency: schema.profileSkills.proficiency,
      yearsOfExperience: schema.profileSkills.yearsOfExperience,
    })
    .from(schema.profileSkills)
    .innerJoin(schema.skills, eq(schema.profileSkills.skillSlug, schema.skills.slug))
    .where(eq(schema.profileSkills.profileId, profileId))
    .orderBy(desc(schema.profileSkills.proficiency));
  return rows.map((r) => ({
    name: r.label,
    proficiency: clampProficiency(r.proficiency),
    yearsOfExperience: r.yearsOfExperience,
  }));
}

/**
 * Top skills for many profiles in one round-trip. Returns a Map keyed by
 * profile id. Each list is capped at 5 entries (in proficiency order)  the
 * search-results card shows ~3 anyway.
 */
async function topSkillsByProfile(
  profileIds: string[],
): Promise<Map<string, SkillRef[]>> {
  if (profileIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      profileId: schema.profileSkills.profileId,
      label: schema.skills.label,
      proficiency: schema.profileSkills.proficiency,
      yearsOfExperience: schema.profileSkills.yearsOfExperience,
    })
    .from(schema.profileSkills)
    .innerJoin(schema.skills, eq(schema.profileSkills.skillSlug, schema.skills.slug))
    .where(inArray(schema.profileSkills.profileId, profileIds))
    .orderBy(
      asc(schema.profileSkills.profileId),
      desc(schema.profileSkills.proficiency),
    );

  const map = new Map<string, SkillRef[]>();
  for (const r of rows) {
    const list = map.get(r.profileId) ?? [];
    if (list.length < 5) {
      list.push({
        name: r.label,
        proficiency: clampProficiency(r.proficiency),
        yearsOfExperience: r.yearsOfExperience,
      });
      map.set(r.profileId, list);
    }
  }
  return map;
}

async function loadExperience(profileId: string): Promise<ExperienceItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.experiences)
    .where(eq(schema.experiences.profileId, profileId))
    .orderBy(desc(schema.experiences.startedAt));
  return rows.map((e) => ({
    role: e.role,
    organization: e.organization,
    city: e.city ?? "",
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    description: e.description ?? undefined,
  }));
}

async function loadQualifications(profileId: string): Promise<QualificationItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      title: schema.qualifications.title,
      institution: schema.qualifications.institution,
      awardedYear: schema.qualifications.awardedYear,
      verification: schema.qualifications.verification,
      // documentStorageKey intentionally NOT in the public read  only
      // an audited employer-reveal flow (Phase 5) gets to see the file.
    })
    .from(schema.qualifications)
    .where(eq(schema.qualifications.profileId, profileId))
    .orderBy(asc(schema.qualifications.awardedYear));
  return rows.map((q) => ({
    title: q.title,
    institution: q.institution,
    awardedYear: q.awardedYear,
    verification: q.verification as VerificationStatus,
  }));
}

async function loadAcademic(profileId: string): Promise<AcademicProfile | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.academicProfiles)
    .where(eq(schema.academicProfiles.profileId, profileId))
    .limit(1);
  const a = rows[0];
  if (!a) return undefined;
  const inst = INSTITUTIONS.find((i) => i.slug === a.institutionSlug);
  return {
    institutionSlug: a.institutionSlug,
    institutionLabel: inst?.label ?? a.institutionSlug,
    institutionKind: (inst?.kind ?? "university") as AcademicProfile["institutionKind"],
    programme: a.programme,
    fieldOfStudy: a.fieldOfStudy,
    nqfLevel: a.nqfLevel as AcademicProfile["nqfLevel"],
    currentYear: a.currentYear,
    expectedGraduation: a.expectedGraduation,
    nsfas: a.nsfas,
    verification: a.verification as VerificationStatus,
    openToInternships: a.openToInternships,
    openToGraduateProgrammes: a.openToGraduateProgrammes,
  };
}

function clampProficiency(n: number): SkillRef["proficiency"] {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as SkillRef["proficiency"];
}
