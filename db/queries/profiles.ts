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
  OpenToTag,
} from "@/lib/mock/types";
import { isOpenToTag } from "@/lib/mock/types";
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

  // Phase 13.10 D7  primary-vs-secondary profession tiebreak. When
  // the search filters on a profession, profiles whose PRIMARY
  // `profession` matches rank above profiles where only a
  // `secondary_professions` entry matched. Within each band the
  // existing score (freshness × completeness × FTS-rank) decides.
  //
  // The CASE returns 0 for primary matches, 1 for secondary-only
  // matches, and 0 for the no-profession-filter case (so the ORDER
  // BY's `primary_match ASC` becomes a no-op when the filter is
  // absent). Citizen-Visibility Rule still ranks above this
  // the ORDER BY puts citizen_group first.
  const primaryMatchKey = filters.profession
    ? sql`CASE WHEN lower(p.profession) = lower(${filters.profession}) THEN 0 ELSE 1 END`
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
    // Profession filter (case-insensitive). Phase 13.10 widens the
    // match: primary `profession` OR any `secondary_professions`
    // entry. Used by the /insights heatmap deep-link; complementary
    // to the FTS `query` path. Both can be active simultaneously
    // the heatmap link passes profession only, leaving free-text
    // empty.
    //
    // D7 in PHASE_13_10_PLAN.md  primary matches still rank above
    // secondary matches on the same query. The ranking CASE lives
    // in the ORDER BY further down; here we only widen the WHERE.
    //
    // The `unnest` over the array is the cheapest correct shape;
    // the GIN index from migration 0048 covers the equality lookup
    // even with the LOWER() wrapper because we hash on the
    // canonical taxonomy LABELs (no case variants in the column).
    conditions.push(sql`(
      lower(p.profession) = lower(${filters.profession})
      OR lower(${filters.profession}) = ANY(
        SELECT lower(s) FROM unnest(p.secondary_professions) AS s
      )
    )`);
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
  // Phase 11.5.1  "open to" tag filter. Same `&&` overlap operator
  // as workAvailability, backed by the GIN index on `open_to_tags`.
  // Empty array (or absent) = no constraint.
  if (filters.openTo && filters.openTo.length > 0) {
    const tagsLiteral = sql.raw(
      `ARRAY[${filters.openTo
        .map((t) => `'${t.replace(/'/g, "''")}'`)
        .join(",")}]::text[]`,
    );
    conditions.push(sql`p.open_to_tags && ${tagsLiteral}`);
  }
  // Phase 9.19 D2  years-experience hard floor. Vacancy is the source
  // of truth: NULL on the vacancy = no constraint (skip entirely).
  // When the floor is set, a NULL on the seeker (`yearsExperience`
  // never declared) does NOT pass  "unknown is not a pass."
  if (
    filters.minYearsExperience !== null &&
    filters.minYearsExperience !== undefined
  ) {
    conditions.push(
      sql`p.years_experience IS NOT NULL AND p.years_experience >= ${filters.minYearsExperience}`,
    );
  }
  // Phase 9.19 D3  NQF floor matches the seeker's HIGHEST academic
  // record (EXISTS over academic_profiles  no record = no pass).
  // NULL on the vacancy = no NQF check at all; trades / hospitality /
  // casual labour / sales roles simply skip this axis and every seeker
  // remains eligible regardless of whether they hold a credential.
  if (filters.minNqfLevel !== null && filters.minNqfLevel !== undefined) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.nqf_level >= ${filters.minNqfLevel})`,
    );
  }

  // Phase 11.3.1  pause-searchability exclusion. A seeker whose
  // `searchability` consent has `paused_until > now()` is paused; we
  // silently drop them from results until the pause expires (cron
  // unpauses; UI shows the chip). NOT EXISTS keeps the row in the
  // result set when no consent row, or when paused_until is NULL.
  conditions.push(
    sql`NOT EXISTS (
      SELECT 1 FROM consents c
      WHERE c.user_id = p.user_id
        AND c.purpose = 'searchability'
        AND c.paused_until IS NOT NULL
        AND c.paused_until > now()
    )`,
  );

  // Phase 11.3.2  seeker-private employer block. When the search is
  // run by a verified employer (callerOrgId set), exclude any profile
  // that has blocked the org. Anonymous + gov + admin callers pass
  // null and the block enforcement is a no-op.
  if (filters.callerOrgId) {
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM seeker_blocked_employers sbe
        WHERE sbe.profile_id = p.id
          AND sbe.org_id = ${filters.callerOrgId}
      )`,
    );
  }

  // Phase 12 fix (2026-06-12)  suspended-account exclusion. Phase 7
  // moderation suspends set `app_user.suspended_at` and bounce sign-in,
  // but nothing removed the profile from public search  a profile
  // suspended via the moderation queue (e.g. fake_identity report)
  // stayed fully visible and contactable nationally. The Phase 12
  // exclusion fixtures surfaced the gap. Restore lifts it instantly.
  conditions.push(
    sql`NOT EXISTS (
      SELECT 1 FROM app_user au
      WHERE au.id = p.user_id
        AND au.suspended_at IS NOT NULL
    )`,
  );

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
      -- Phase 13.10  surface the array so callers can render
      -- the "matched via secondary" annotation on /vacancies/[id]/match
      -- when the query's profession filter matched a secondary entry
      -- rather than the primary.
      p.secondary_professions,
      p.seniority,
      p.city,
      p.province,
      p.nationality,
      p.is_citizen,
      p.bio,
      p.status,
      p.status_confirmed_at,
      p.work_availability,
      p.open_to_tags,
      p.verification,
      p.completeness,
      p.years_experience,
      p.member_since,
      p.current_employer_org_id,
      p.current_role_started_at,
      orgs.name AS current_employer_name,
      orgs.origin AS current_employer_origin,
      orgs.verification AS current_employer_verification,
      (
        ${rankExpr}
        * sebenza_freshness_confidence(p.status_confirmed_at)
        * (0.5 + 0.5 * (p.completeness::numeric / 100))
      ) AS score,
      ${citizenGroupKey} AS citizen_group,
      ${primaryMatchKey} AS primary_match
    FROM profiles p
    LEFT JOIN organizations orgs ON orgs.id = p.current_employer_org_id
    WHERE ${whereClause}
    ORDER BY citizen_group ASC, primary_match ASC, score DESC NULLS LAST, p.completeness DESC
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
    secondary_professions: string[] | string | null;
    seniority: string | null;
    city: string;
    province: string;
    nationality: string | null;
    is_citizen: boolean;
    bio: string | null;
    status: string;
    status_confirmed_at: string | Date;
    work_availability: string[] | string | null;
    open_to_tags: string[] | string | null;
    verification: string;
    completeness: number;
    years_experience: number | null;
    member_since: string | Date;
    current_employer_org_id: string | null;
    current_role_started_at: string | Date | null;
    current_employer_name: string | null;
    current_employer_origin: string | null;
    current_employer_verification: string | null;
    score: string;
  }> }).rows;

  // Pull top-skills for the matched profiles in one extra query.
  // We bound the list (max 5 per profile, in proficiency order) to keep the
  // payload light  public/search reads don't need every skill.
  const ids = rows.map((r) => r.id);
  const [skillsByProfile, verifiedAtByProfile] =
    ids.length > 0
      ? await Promise.all([
          topSkillsByProfile(ids),
          // Phase 9.23  one batched lookup of the latest verified
          // verification per (profile, current_employer) within the
          // 12-month badge window.
          verificationBadgeDatesByProfile(rows),
        ])
      : [new Map(), new Map<string, string>()];

  const profiles: SearchResultRow[] = rows.map((r) => ({
    handle: r.handle,
    displayName: r.display_name,
    profilePhotoUrl: r.profile_photo_url, // raw key; signed by dbProvider
    profession: r.profession,
    // Phase 13.10  reuse the same pg-array parser used for
    // workAvailability / openToTags so `{Barista,Caregiver}` and
    // ["Barista", "Caregiver"] both normalise to a string[].
    secondaryProfessions: parsePgEnumArray(r.secondary_professions),
    seniority: (r.seniority as Seniority | null) ?? null,
    city: r.city,
    province: r.province,
    nationality: r.nationality,
    isCitizen: r.is_citizen,
    bio: r.bio ?? undefined,
    status: r.status as EmploymentStatus,
    statusConfirmedAt: new Date(r.status_confirmed_at).toISOString(),
    workAvailability: parsePgEnumArray(r.work_availability) as WorkAvailabilityKind[],
    // Phase 11.5.1  voluntary secondary-intent tags. Same pg-array
    // parser as workAvailability + the runtime guard filters out any
    // out-of-set value.
    openToTags: parsePgEnumArray(r.open_to_tags).filter(isOpenToTag) as OpenToTag[],
    verification: r.verification as VerificationStatus,
    completeness: r.completeness,
    yearsExperience: r.years_experience,
    memberSince: new Date(r.member_since).toISOString(),
    topSkills: skillsByProfile.get(r.id) ?? [],
    score: Number(r.score),
    // Phase 9.22  current employer block. Same picker-visibility
    // guard as findProfileByHandle (pending orgs hidden).
    ...employerPayload({
      orgId: r.current_employer_org_id,
      name: r.current_employer_name,
      origin: r.current_employer_origin,
      verification: r.current_employer_verification,
      roleStartedAt:
        r.current_role_started_at instanceof Date
          ? r.current_role_started_at.toISOString().slice(0, 10)
          : r.current_role_started_at,
    }),
    employmentVerifiedAt: verifiedAtByProfile.get(r.id) ?? null,
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
  // Phase 13.10  honest-supply mirror of the profession filter
  // widened in searchProfilesQuery. Without this, the count
  // overstates the matching pool when the caller filters by
  // profession  the ranked list and the honest-supply line would
  // disagree. Same widened shape: primary OR any secondary.
  if (filters.profession) {
    conditions.push(sql`(
      lower(p.profession) = lower(${filters.profession})
      OR lower(${filters.profession}) = ANY(
        SELECT lower(s) FROM unnest(p.secondary_professions) AS s
      )
    )`);
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
  // Phase 9.19  mirror the years/NQF gates so the honest-supply
  // counts agree with the ranked list (every WHERE clause must match).
  if (
    filters.minYearsExperience !== null &&
    filters.minYearsExperience !== undefined
  ) {
    conditions.push(
      sql`p.years_experience IS NOT NULL AND p.years_experience >= ${filters.minYearsExperience}`,
    );
  }
  if (filters.minNqfLevel !== null && filters.minNqfLevel !== undefined) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.nqf_level >= ${filters.minNqfLevel})`,
    );
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
      // Phase 13.10  additional profession lanes (cap 3, labels).
      // Public per D1; rendered on /p/<handle> as the "Also
      // experienced in" chip row.
      secondaryProfessions: schema.profiles.secondaryProfessions,
      seniority: schema.profiles.seniority,
      city: schema.profiles.city,
      province: schema.profiles.province,
      nationality: schema.profiles.nationality,
      isCitizen: schema.profiles.isCitizen,
      bio: schema.profiles.bio,
      status: schema.profiles.status,
      statusConfirmedAt: schema.profiles.statusConfirmedAt,
      workAvailability: schema.profiles.workAvailability,
      openToTags: schema.profiles.openToTags,
      verification: schema.profiles.verification,
      completeness: schema.profiles.completeness,
      yearsExperience: schema.profiles.yearsExperience,
      memberSince: schema.profiles.memberSince,
      // Phase 9.22  surface current employment when the org is
      // picker-visible. Pending seeker_named orgs (verification !=
      // 'verified') never reach the public payload.
      currentEmployerOrgId: schema.profiles.currentEmployerOrgId,
      currentRoleStartedAt: schema.profiles.currentRoleStartedAt,
      currentEmployerName: schema.organizations.name,
      currentEmployerOrigin: schema.organizations.origin,
      currentEmployerVerification: schema.organizations.verification,
    })
    .from(schema.profiles)
    .leftJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.profiles.currentEmployerOrgId),
    )
    .where(
      and(
        eq(schema.profiles.handle, handle),
        isNull(schema.profiles.deletedAt),
        // Phase 12 fix (2026-06-12)  suspended accounts' public dossiers
        // go dark alongside their search rows (see searchProfilesQuery).
        sql`NOT EXISTS (
          SELECT 1 FROM app_user au
          WHERE au.id = ${schema.profiles.userId}
            AND au.suspended_at IS NOT NULL
        )`,
      ),
    )
    .limit(1);

  const p = rows[0];
  if (!p) return null;

  const [topSkills, experience, qualifications, academic, verifiedAtIso] =
    await Promise.all([
      loadTopSkills(p.id),
      loadExperience(p.id),
      loadQualifications(p.id),
      loadAcademic(p.id),
      // Phase 9.23  verification badge date (D6: only within 12mo).
      loadVerificationBadgeDate(p.id, p.currentEmployerOrgId),
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
    // Phase 13.10  additive lanes alongside primary `profession`.
    // Public per D1 in PHASE_13_10_PLAN.md  surfaces on /p/<handle>
    // as the "Also experienced in" chip row. Empty array = single-
    // profession seeker (the default for every pre-Phase-13.10 row).
    secondaryProfessions: p.secondaryProfessions ?? [],
    seniority: (p.seniority as Seniority | null) ?? null,
    city: p.city,
    province: p.province,
    nationality: p.nationality,
    isCitizen: p.isCitizen,
    bio: p.bio ?? undefined,
    status: p.status as EmploymentStatus,
    statusConfirmedAt: p.statusConfirmedAt.toISOString(),
    workAvailability: (p.workAvailability ?? []) as WorkAvailabilityKind[],
    // Phase 11.5.1  voluntary secondary-intent tags. Unknown values
    // filtered out by the runtime guard.
    openToTags: ((p.openToTags ?? []) as string[]).filter(isOpenToTag) as OpenToTag[],
    verification: p.verification as VerificationStatus,
    completeness: p.completeness,
    yearsExperience: p.yearsExperience,
    memberSince: p.memberSince.toISOString(),
    topSkills,
    experience,
    qualifications,
    academic,
    // Phase 9.22  surface employer only when picker-visible. Pending
    // seeker_named orgs (origin='seeker_named' AND verification !=
    // 'verified') are hidden  honest about state.
    ...employerPayload({
      orgId: p.currentEmployerOrgId,
      name: p.currentEmployerName,
      origin: p.currentEmployerOrigin,
      verification: p.currentEmployerVerification,
      roleStartedAt: p.currentRoleStartedAt,
    }),
    // Phase 9.23  badge date only when within the 12-month lifetime.
    employmentVerifiedAt: verifiedAtIso,
  };
}

/**
 * Phase 9.23  load the most recent verified-state verification
 * row for (profile, current_employer_org_id). Returns the responded_at
 * ISO date when state='verified' AND the response is within the
 * 12-month badge lifetime (D6). Anything older or non-verified
 * returns NULL  the badge silently decays.
 */
const VERIFICATION_BADGE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Phase 9.23  batched variant for searchProfilesQuery. Takes the
 * page of search rows + returns a Map<profileId, ISO> for those
 * whose current employer has a verified verification within the
 * 12-month window. Profiles without an employer or without a
 * recent verified row simply don't appear in the map (caller falls
 * back to NULL).
 */
async function verificationBadgeDatesByProfile(
  rows: Array<{
    id: string;
    current_employer_org_id: string | null;
  }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const pairs = rows.filter(
    (r): r is typeof r & { current_employer_org_id: string } =>
      r.current_employer_org_id !== null,
  );
  if (pairs.length === 0) return result;
  const db = getDb();
  const cutoff = new Date(Date.now() - VERIFICATION_BADGE_LIFETIME_MS);
  const profileIds = pairs.map((p) => p.id);
  const employerIds = pairs.map((p) => p.current_employer_org_id);
  const verRows = await db
    .select({
      profileId: schema.employmentVerifications.profileId,
      employerOrgId: schema.employmentVerifications.employerOrgId,
      respondedAt: schema.employmentVerifications.respondedAt,
    })
    .from(schema.employmentVerifications)
    .where(
      and(
        eq(schema.employmentVerifications.state, "verified"),
        sql`${schema.employmentVerifications.respondedAt} >= ${cutoff}`,
        inArray(schema.employmentVerifications.profileId, profileIds),
        inArray(schema.employmentVerifications.employerOrgId, employerIds),
      ),
    )
    .orderBy(desc(schema.employmentVerifications.respondedAt));
  // Keep only the most recent per (profile, employer) pair where the
  // employer matches the current declared employer.
  const employerByProfile = new Map(
    pairs.map((p) => [p.id, p.current_employer_org_id]),
  );
  for (const v of verRows) {
    if (employerByProfile.get(v.profileId) !== v.employerOrgId) continue;
    if (result.has(v.profileId)) continue;
    if (!v.respondedAt) continue;
    result.set(
      v.profileId,
      v.respondedAt instanceof Date
        ? v.respondedAt.toISOString()
        : new Date(v.respondedAt).toISOString(),
    );
  }
  return result;
}

async function loadVerificationBadgeDate(
  profileId: string,
  employerOrgId: string | null,
): Promise<string | null> {
  if (!employerOrgId) return null;
  const db = getDb();
  const cutoff = new Date(Date.now() - VERIFICATION_BADGE_LIFETIME_MS);
  const rows = await db
    .select({
      respondedAt: schema.employmentVerifications.respondedAt,
    })
    .from(schema.employmentVerifications)
    .where(
      and(
        eq(schema.employmentVerifications.profileId, profileId),
        eq(schema.employmentVerifications.employerOrgId, employerOrgId),
        eq(schema.employmentVerifications.state, "verified"),
        sql`${schema.employmentVerifications.respondedAt} >= ${cutoff}`,
      ),
    )
    .orderBy(desc(schema.employmentVerifications.respondedAt))
    .limit(1);
  const r = rows[0];
  if (!r?.respondedAt) return null;
  return r.respondedAt instanceof Date
    ? r.respondedAt.toISOString()
    : new Date(r.respondedAt).toISOString();
}

/**
 * Phase 9.22  shared shaper for the public-payload's current-employer
 * fields. Returns an empty object (NULL all three) when the org is
 * either NULL or not picker-visible. Used by both findProfileByHandle
 * and searchProfilesQuery so the two surfaces stay in lockstep.
 */
function employerPayload(args: {
  orgId: string | null;
  name: string | null;
  origin: string | null;
  verification: string | null;
  roleStartedAt: string | null;
}): {
  currentEmployerName?: string | null;
  currentEmployerBadge?: "sebenza_registered" | "seeker_named_verified" | null;
  currentRoleStartedAt?: string | null;
} {
  if (!args.orgId || !args.name) return {};
  const visible =
    args.origin === "sebenza_registered" || args.verification === "verified";
  if (!visible) return {};
  return {
    currentEmployerName: args.name,
    currentEmployerBadge:
      args.origin === "sebenza_registered"
        ? "sebenza_registered"
        : "seeker_named_verified",
    currentRoleStartedAt: args.roleStartedAt,
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
    // Phase 13.1  current-semester student context. Surfaced on the
    // seeker's own /dashboard/profile editor + used by the matcher;
    // NOT rendered on the public profile (the /p/{handle} renderer
    // doesn't reference these fields). Project topic in particular
    // can carry identifying detail, so the default-private posture
    // is the right one.
    currentModules: (a.currentModules ?? []) as string[],
    electiveChosen: a.electiveChosen ?? null,
    projectTopic: a.projectTopic ?? null,
  };
}

function clampProficiency(n: number): SkillRef["proficiency"] {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as SkillRef["proficiency"];
}
