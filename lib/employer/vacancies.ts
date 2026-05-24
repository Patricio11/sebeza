"use server";

/**
 * Phase 9.8.1  Vacancies CRUD (Server Actions + read helpers).
 *
 * Privacy invariant: every read function filters by `organizationId`.
 * Every write Server Action calls `verifyEmployer()` (which resolves
 * the caller's org context) and then double-checks the vacancy
 * belongs to that org before mutating. There is no code path in this
 * file that reads or writes a vacancy without an `organizationId`
 * filter  the 9.8.8 compliance assertion (a) catches regressions.
 *
 * Role gating: Owner + Recruiter can create / edit / change-status;
 * Viewer is strictly read-only. Enforced via `canEditVacancies()`
 * against the existing `orgMemberRole` enum.
 *
 * No vacancy field is exposed on any public route, /p/[handle],
 * /search, sitemap, or to a non-member of the owning org. Salary
 * band is held server-side only; UI strips it for the Viewer role
 * (`canSeeSalary()`).
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import {
  countMatchesByCitizenship,
  searchProfilesQuery,
  type SearchResultRow,
} from "@/db/queries/profiles";
import {
  PROFESSIONS as MOCK_PROFESSIONS,
  SKILLS as MOCK_SKILLS,
} from "@/lib/mock/taxonomy";
import type { SearchFilters, Seniority } from "@/lib/mock/types";
import type {
  OrgMemberRole,
  VacancyStatus,
} from "./vacancies-types";
import { canEditVacancies } from "./vacancies-types";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape returned by reads. Plain serialisable type so it crosses the
// server/client boundary cleanly when handed to client islands.
// ─────────────────────────────────────────────────────────────────────────────

export interface VacancyRow {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  professionSlug: string;
  provinceSlug: string;
  citySlug: string | null;
  skillSlugs: string[];
  seniority: string | null;
  salaryBand: string | null;
  description: string | null;
  documentsRequired: string[];
  status: VacancyStatus;
  inviteExpiryDays: number | null;
  createdAt: string; // ISO
  closedAt: string | null;
}

function rowToVacancy(r: typeof schema.vacancies.$inferSelect): VacancyRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    createdByUserId: r.createdByUserId,
    title: r.title,
    professionSlug: r.professionSlug,
    provinceSlug: r.provinceSlug,
    citySlug: r.citySlug ?? null,
    skillSlugs: r.skillSlugs ?? [],
    seniority: r.seniority ?? null,
    salaryBand: r.salaryBand ?? null,
    description: r.description ?? null,
    documentsRequired: r.documentsRequired ?? [],
    status: r.status as VacancyStatus,
    inviteExpiryDays: r.inviteExpiryDays ?? null,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : new Date(r.createdAt).toISOString(),
    closedAt: r.closedAt
      ? r.closedAt instanceof Date
        ? r.closedAt.toISOString()
        : new Date(r.closedAt).toISOString()
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List every vacancy belonging to the caller's organisation. Sorted
 * by `createdAt` descending (newest first). Caller's role determines
 * whether salary_band is included in the rendered UI; the read itself
 * always returns it (server-side filter happens at render time per the
 * role check). Empty array when the caller has no org context.
 */
export async function listMyVacancies(): Promise<VacancyRow[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.vacancies)
    .where(eq(schema.vacancies.organizationId, session.orgId))
    .orderBy(desc(schema.vacancies.createdAt));
  return rows.map(rowToVacancy);
}

/**
 * Load a single vacancy, scoped to the caller's org. Returns `null`
 * when the id doesn't match an org-owned vacancy  the function does
 * NOT differentiate "doesn't exist" from "exists but not yours" so
 * an attacker can't probe for the existence of another org's vacancies.
 */
export async function getMyVacancy(
  vacancyId: string,
): Promise<VacancyRow | null> {
  const session = await verifyEmployer();
  if (!session.orgId) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.vacancies)
    .where(
      and(
        eq(schema.vacancies.id, vacancyId),
        eq(schema.vacancies.organizationId, session.orgId),
      ),
    )
    .limit(1);
  return rows[0] ? rowToVacancy(rows[0]) : null;
}

/**
 * Resolve the caller's role within their org (Owner / Recruiter /
 * Viewer). Used by pages to decide whether to render create/edit
 * buttons or hide the salary band. Server Actions re-check role
 * independently  this is a UX optimisation, not a security boundary.
 */
export async function getMyOrgRole(): Promise<OrgMemberRole | null> {
  const session = await verifyEmployer();
  if (!session.orgId) return null;
  const db = getDb();
  const rows = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, session.orgId),
        eq(schema.organizationMembers.userId, session.id),
      ),
    )
    .limit(1);
  return (rows[0]?.role as OrgMemberRole | undefined) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes  Server Actions
// ─────────────────────────────────────────────────────────────────────────────

const vacancyInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  professionSlug: z.string().min(1),
  provinceSlug: z.string().min(1),
  citySlug: z.string().min(1).nullable().optional(),
  skillSlugs: z.array(z.string()).max(20).optional(),
  seniority: z.string().trim().max(40).nullable().optional(),
  salaryBand: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  documentsRequired: z.array(z.string()).max(20).optional(),
  /** D2  per-vacancy invite expiry. Empty / 0 means "no expiry."
   *  Capped at 365 days  beyond that the cron would be paging
   *  ghost invitations from a long-dead vacancy. */
  inviteExpiryDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .nullable()
    .optional(),
});

const transitionSchema = z.object({
  vacancyId: z.string().min(1),
  next: z.enum(["draft", "open", "closed", "filled"]),
});

/** Resolve the caller's role + verify edit permission in one call.
 *  Returns `fail(...)` if the caller can't edit; otherwise an `ok`
 *  carrying the org id + caller id so the action can write safely. */
async function requireEditRole(): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; message: string }
> {
  const session = await verifyEmployer();
  if (!session.orgId) {
    return { ok: false, message: "No organisation context." };
  }
  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    return {
      ok: false,
      message:
        "Your role is read-only for vacancies. Ask an Owner or Recruiter to make this change.",
    };
  }
  return { ok: true, orgId: session.orgId, userId: session.id };
}

export async function createVacancy(
  input: z.infer<typeof vacancyInputSchema>,
): Promise<ActionResult<{ vacancyId: string }>> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;

  const parsed = vacancyInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Invalid vacancy input.",
    );
  }
  const v = parsed.data;
  const id = `vac_${randomUUID()}`;
  const db = getDb();

  await db.insert(schema.vacancies).values({
    id,
    organizationId: guard.orgId,
    createdByUserId: guard.userId,
    title: v.title,
    professionSlug: v.professionSlug,
    provinceSlug: v.provinceSlug,
    citySlug: v.citySlug ?? null,
    skillSlugs: v.skillSlugs ?? [],
    seniority: v.seniority ?? null,
    salaryBand: v.salaryBand ?? null,
    description: v.description ?? null,
    documentsRequired: v.documentsRequired ?? [],
    status: "draft" as const,
    inviteExpiryDays: v.inviteExpiryDays ?? null,
  });

  await logAccess({
    kind: "vacancy.create",
    actor: guard.userId,
    subject: id,
    meta: {
      orgId: guard.orgId,
      title: v.title,
      profession: v.professionSlug,
      province: v.provinceSlug,
    },
  });

  revalidatePath("/employer/vacancies");
  return ok({ vacancyId: id });
}

export async function updateVacancy(
  vacancyId: string,
  input: z.infer<typeof vacancyInputSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;

  // Re-fetch + verify org ownership BEFORE applying the patch  the
  // privacy invariant is that no caller ever mutates a vacancy that
  // doesn't belong to their org.
  const existing = await getMyVacancy(vacancyId);
  if (!existing) return fail("Vacancy not found in your organisation.");

  const parsed = vacancyInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Invalid vacancy input.",
    );
  }
  const v = parsed.data;
  const db = getDb();

  await db
    .update(schema.vacancies)
    .set({
      title: v.title,
      professionSlug: v.professionSlug,
      provinceSlug: v.provinceSlug,
      citySlug: v.citySlug ?? null,
      skillSlugs: v.skillSlugs ?? [],
      seniority: v.seniority ?? null,
      salaryBand: v.salaryBand ?? null,
      description: v.description ?? null,
      documentsRequired: v.documentsRequired ?? [],
      inviteExpiryDays: v.inviteExpiryDays ?? null,
    })
    .where(
      and(
        eq(schema.vacancies.id, vacancyId),
        eq(schema.vacancies.organizationId, guard.orgId),
      ),
    );

  await logAccess({
    kind: "vacancy.update",
    actor: guard.userId,
    subject: vacancyId,
    meta: { orgId: guard.orgId },
  });

  revalidatePath("/employer/vacancies");
  revalidatePath(`/employer/vacancies/${vacancyId}`);
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9.8.2  Reverse-matching ("Find matches")
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SENIORITY: Seniority[] = ["junior", "intermediate", "senior"];

/**
 * Build the public-search filter set from a vacancy. One ranking source of
 * truth: the same `searchProfilesQuery` used by /search runs against these
 * filters. Profession + required skills get concatenated into the FTS
 * `query` (they live in the search_vector index already). Province is the
 * slug; the query layer ILIKE-matches it against the human label.
 *
 * Seniority is only forwarded if the vacancy uses the canonical lowercase
 * value (`junior` / `intermediate` / `senior`)  the create-form catalog
 * shows title-case strings, so we normalise here.
 */
// Not exported: a "use server" module exposes only async Server Actions to
// callers. This is a pure sync mapping used by matchVacancyCandidates()
// below; if a caller ever needs the filters directly, move to a sibling
// plain module rather than re-exporting from here.
function vacancyToSearchFilters(
  vacancy: VacancyRow,
): SearchFilters {
  const professionLabel =
    MOCK_PROFESSIONS.find((p) => p.slug === vacancy.professionSlug)?.label ??
    vacancy.professionSlug;
  const skillLabels = vacancy.skillSlugs
    .map((s) => MOCK_SKILLS.find((sk) => sk.slug === s)?.label)
    .filter((s): s is string => Boolean(s));
  const query = [professionLabel, ...skillLabels].join(" ").trim();

  const seniorityNormalised =
    vacancy.seniority && VALID_SENIORITY.includes(
      vacancy.seniority.toLowerCase() as Seniority,
    )
      ? (vacancy.seniority.toLowerCase() as Seniority)
      : null;

  return {
    query: query || undefined,
    province: vacancy.provinceSlug,
    city: vacancy.citySlug ?? null,
    seniority: seniorityNormalised,
    highlightCitizens: true,
  };
}

export interface VacancyMatchResult {
  filters: SearchFilters;
  /** Top-ranked candidates (capped by SEARCH_LIMIT inside searchProfilesQuery). */
  candidates: SearchResultRow[];
  /** Honest-supply counts over the full match set (not just the visible page). */
  counts: { total: number; saCitizen: number; foreignNational: number };
}

/**
 * Compose the match view for a given vacancy. Two queries: the ranked
 * list (capped) + the full-match citizenship buckets (for the honest-
 * supply line). Both use identical WHERE clauses so the figures are
 * internally consistent.
 *
 * Caller is responsible for the org-ownership check on the vacancy
 * before calling (the page passes a vacancy already loaded via
 * getMyVacancy()).
 */
export async function matchVacancyCandidates(
  vacancy: VacancyRow,
): Promise<VacancyMatchResult> {
  const filters = vacancyToSearchFilters(vacancy);
  const [search, counts] = await Promise.all([
    searchProfilesQuery(filters),
    countMatchesByCitizenship(filters),
  ]);
  return { filters, candidates: search.profiles, counts };
}

export async function transitionVacancyStatus(
  input: z.infer<typeof transitionSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid status transition.");
  const { vacancyId, next } = parsed.data;

  const existing = await getMyVacancy(vacancyId);
  if (!existing) return fail("Vacancy not found in your organisation.");
  const prior = existing.status;

  // Bounded state machine. The Phase 5/7.5.5 placement flow handles
  // `filled` separately when an actual placement is logged; here we
  // accept the transition for the lifecycle marker, but the real
  // proof-of-fill is the placement row (see 9.8.6 for the linkage).
  const ALLOWED: Record<VacancyStatus, VacancyStatus[]> = {
    draft: ["open", "closed"],
    open: ["closed", "filled"],
    closed: ["open"],
    filled: ["closed"],
  };
  if (!ALLOWED[prior].includes(next)) {
    return fail(`Cannot move a ${prior} vacancy to ${next}.`);
  }

  const db = getDb();
  await db
    .update(schema.vacancies)
    .set({
      status: next,
      closedAt: next === "closed" || next === "filled" ? new Date() : null,
    })
    .where(
      and(
        eq(schema.vacancies.id, vacancyId),
        eq(schema.vacancies.organizationId, guard.orgId),
      ),
    );

  await logAccess({
    kind: "vacancy.status.change",
    actor: guard.userId,
    subject: vacancyId,
    meta: { orgId: guard.orgId, prior, next },
  });

  revalidatePath("/employer/vacancies");
  revalidatePath(`/employer/vacancies/${vacancyId}`);
  return ok();
}
