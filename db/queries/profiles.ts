/**
 * Phase 4 — Postgres-backed profile queries.
 *
 * Every function here is the **canonical public read path**. The shape we
 * return is `PublicProfile` (with `profilePhotoUrl` as a raw storage key —
 * the dbProvider wrapper signs it before handing to consumers).
 *
 * Redaction Rule (`docs/SECURITY.md`): every SELECT here enumerates the
 * exact columns we want. `nationalIdEnc`, `fullSurname`, `searchVector`,
 * and `email` are NEVER selected on a public read.
 *
 * Search SQL mirrors `lib/mock/helpers.rankProfiles` so the ranking
 * "feels" identical before and after the swap:
 *   relevance × freshness_confidence × completeness × citizen_boost
 */

import "server-only";
import { sql, eq, desc, asc, and, isNull } from "drizzle-orm";
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
} from "@/lib/mock/types";
import { INSTITUTIONS } from "@/lib/mock/taxonomy";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_LIMIT = 50;

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
  // all rows and the WHERE @@ clause would match nothing — so we branch.
  const rankExpr = hasQuery
    ? sql`ts_rank_cd(p.search_vector, websearch_to_tsquery('simple', ${q}))`
    : sql`1.0::numeric`;

  const citizenBoost = filters.highlightCitizens
    ? sql`CASE WHEN p.is_citizen THEN 1.08 ELSE 1.0 END`
    : sql`1.0::numeric`;

  // WHERE clauses — assembled conditionally so a missing filter doesn't
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
    // Filters arrive as slugs (e.g. "western-cape") but the column stores
    // the human label ("Western Cape"). Use ILIKE for case-insensitive
    // hyphen-tolerant match.
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
      p.verification,
      p.completeness,
      p.member_since,
      (
        ${rankExpr}
        * sebenza_freshness_confidence(p.status_confirmed_at)
        * (0.5 + 0.5 * (p.completeness::numeric / 100))
        * ${citizenBoost}
      ) AS score
    FROM profiles p
    WHERE ${whereClause}
    ORDER BY score DESC NULLS LAST, p.completeness DESC
    LIMIT ${SEARCH_LIMIT}
  `);
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
    status_confirmed_at: Date;
    verification: string;
    completeness: number;
    member_since: Date;
    score: string;
  }> }).rows;

  // Pull top-skills for the matched profiles in one extra query.
  // We bound the list (max 5 per profile, in proficiency order) to keep the
  // payload light — public/search reads don't need every skill.
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
    statusConfirmedAt: r.status_confirmed_at.toISOString(),
    verification: r.verification as VerificationStatus,
    completeness: r.completeness,
    memberSince: r.member_since.toISOString(),
    topSkills: skillsByProfile.get(r.id) ?? [],
    score: Number(r.score),
  }));

  // Skills-gap signal — every search writes a row. Phase 6 builds on this.
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
      verification: schema.profiles.verification,
      completeness: schema.profiles.completeness,
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
    verification: p.verification as VerificationStatus,
    completeness: p.completeness,
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
// Helpers — child-table loaders
// ─────────────────────────────────────────────────────────────────────────────

async function loadTopSkills(profileId: string): Promise<SkillRef[]> {
  const db = getDb();
  const rows = await db
    .select({
      label: schema.skills.label,
      proficiency: schema.profileSkills.proficiency,
    })
    .from(schema.profileSkills)
    .innerJoin(schema.skills, eq(schema.profileSkills.skillSlug, schema.skills.slug))
    .where(eq(schema.profileSkills.profileId, profileId))
    .orderBy(desc(schema.profileSkills.proficiency));
  return rows.map((r) => ({
    name: r.label,
    proficiency: clampProficiency(r.proficiency),
  }));
}

/**
 * Top skills for many profiles in one round-trip. Returns a Map keyed by
 * profile id. Each list is capped at 5 entries (in proficiency order) — the
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
    })
    .from(schema.profileSkills)
    .innerJoin(schema.skills, eq(schema.profileSkills.skillSlug, schema.skills.slug))
    .where(sql`${schema.profileSkills.profileId} = ANY(${profileIds})`)
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
      // documentStorageKey intentionally NOT in the public read — only
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
