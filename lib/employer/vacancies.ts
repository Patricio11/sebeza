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
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer, verifyOrgVerified } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";
import {
  composeOutcomeNotification,
  type OutcomeComposerInput,
} from "@/lib/seeker/vacancy-outcome";
import {
  declineReasonAggregateQuery,
  type DeclineReasonValue,
} from "@/db/queries/decline-reasons";
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.11  Mark-as-Filled with batch hire capture + outcome fan-out
//
// The combined action replaces today's "flip to filled, hope they
// remember to log the placement later" two-step. The Mark-as-Filled
// button now opens a modal that requires picking ≥ 1 hire (or an
// explicit skip). On submit, this action runs everything in one
// transaction: insert N placements + flip vacancy state + fire N
// placement.confirmed notifications. AFTER the transaction commits,
// we enumerate the not-selected accepted-invitee audience and fan
// out the vacancy.outcome.other-hired growth notification (best-
// effort  failure here doesn't roll back the hire).
//
// Reveal-gate accommodation: the existing markAsHired requires a
// prior `profile.contact.reveal` audit row within 30 days. That
// gate is correct for the dossier-driven flow but wrong for the
// invitation flow  the invitation itself IS two-way engagement.
// This action bypasses the gate when the hire is an accepted
// invitee on THIS vacancy; otherwise it enforces the gate (the
// outside-pipeline hire still needs a prior reveal so we don't
// allow "log a hire for someone you never engaged with").
// ─────────────────────────────────────────────────────────────────────────────

const REVEAL_GATE_DAYS = 30;
const OUTCOME_FANOUT_CAP = 100;

const hireInputSchema = z.object({
  profileId: z.string().min(1),
  hiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  salaryBand: z.string().trim().max(80).optional(),
});

const markFilledSchema = z.object({
  vacancyId: z.string().min(1),
  hires: z.array(hireInputSchema).min(1).max(20),
  /** Shared salary band applied to any hire that didn't override.
   *  Empty string treated as "no override"  per-hire stays null. */
  sharedSalaryBand: z.string().trim().max(80).optional(),
});

export async function markVacancyFilledAndLogHires(
  input: z.infer<typeof markFilledSchema>,
): Promise<ActionResult<{ placementIds: string[]; notSelectedCount: number }>> {
  // Verified-org gate  hiring is a PII-touching action.
  const session = await verifyOrgVerified();
  const parsed = markFilledSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid hire input.");
  }
  const v = parsed.data;

  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    return fail(
      "Your role is read-only for vacancies. Ask an Owner or Recruiter to log hires.",
    );
  }

  // Vacancy must belong to caller's org + be in open/draft.
  const vacancy = await getMyVacancy(v.vacancyId);
  if (!vacancy) return fail("Vacancy not found in your organisation.");
  if (vacancy.status !== "open" && vacancy.status !== "draft") {
    return fail(
      `This vacancy is already ${vacancy.status}  use the placements panel to log additional hires.`,
    );
  }

  const db = getDb();

  // Dedup profileIds in the batch  same person can't be hired twice
  // for the same vacancy.
  const uniqueHires = Array.from(
    new Map(v.hires.map((h) => [h.profileId, h])).values(),
  );
  const hireProfileIds = uniqueHires.map((h) => h.profileId);

  // Resolve profile rows for the hire batch.
  const profileRows = await db
    .select({
      id: schema.profiles.id,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      userId: schema.profiles.userId,
      city: schema.profiles.city,
      profession: schema.profiles.profession,
    })
    .from(schema.profiles)
    .where(inArray(schema.profiles.id, hireProfileIds));
  if (profileRows.length !== uniqueHires.length) {
    return fail("One or more hired profiles couldn't be resolved.");
  }
  const profileById = new Map(profileRows.map((p) => [p.id, p]));

  // Accepted-invitee set on this vacancy  these bypass the reveal
  // gate because the invitation IS two-way engagement.
  const acceptedRows = await db
    .select({
      profileId: schema.vacancyInvitations.profileId,
      state: schema.vacancyInvitations.state,
    })
    .from(schema.vacancyInvitations)
    .where(eq(schema.vacancyInvitations.vacancyId, v.vacancyId));
  const acceptedProfileIds = new Set(
    acceptedRows
      .filter(
        (r) => r.state === "accepted" || r.state === "accepted_with_notice",
      )
      .map((r) => r.profileId),
  );

  // For hires NOT on the accepted-invitee list, enforce the existing
  // 30-day reveal gate. Single bulk query for all such profiles.
  const outsidePipelineIds = hireProfileIds.filter(
    (id) => !acceptedProfileIds.has(id),
  );
  if (outsidePipelineIds.length > 0) {
    const since = new Date(
      Date.now() - REVEAL_GATE_DAYS * 24 * 60 * 60 * 1000,
    );
    const reveals = await db
      .select({
        subject: schema.auditLog.subject,
      })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.kind, "profile.contact.reveal"),
          inArray(schema.auditLog.subject, outsidePipelineIds),
          sql`${schema.auditLog.at} >= ${since}`,
          sql`${schema.auditLog.meta}->>'orgId' = ${session.orgId}`,
        ),
      );
    const revealedSet = new Set(reveals.map((r) => r.subject));
    const missing = outsidePipelineIds.filter((id) => !revealedSet.has(id));
    if (missing.length > 0) {
      const missingHandles = missing
        .map((id) => profileById.get(id)?.handle ?? id)
        .join(", ");
      return fail(
        `These hires need a prior contact reveal within the last 30 days: ${missingHandles}. Open each dossier first, then retry.`,
      );
    }
  }

  // ── Transactional write ────────────────────────────────────────────────
  // All-or-nothing: vacancy state flip + N placements + N audit rows.
  // Notifications fire outside the transaction (best-effort) per the
  // existing pattern in createNotification.
  const placementIds: string[] = [];
  const sharedSalary = v.sharedSalaryBand?.trim() || null;

  await db.transaction(async (tx) => {
    for (const hire of uniqueHires) {
      const profile = profileById.get(hire.profileId)!;
      const placementId = `plc_${randomUUID()}`;
      placementIds.push(placementId);
      await tx.insert(schema.placements).values({
        id: placementId,
        profileId: profile.id,
        organizationId: session.orgId,
        actorUserId: session.id,
        role: vacancy.title,
        city: profile.city,
        hiredAt: hire.hiredAt ? new Date(hire.hiredAt) : new Date(),
        salaryBand: hire.salaryBand?.trim() || sharedSalary,
        source: "employer_confirmed" as const,
        vacancyId: v.vacancyId,
      });
    }

    await tx
      .update(schema.vacancies)
      .set({
        status: "filled" as const,
        closedAt: new Date(),
      })
      .where(
        and(
          eq(schema.vacancies.id, v.vacancyId),
          eq(schema.vacancies.organizationId, session.orgId),
        ),
      );
  });

  // ── Audit log: one batch row + one per-placement row ──────────────────
  await logAccess({
    kind: "org.vacancy.filled.batch",
    actor: session.id,
    subject: v.vacancyId,
    meta: {
      orgId: session.orgId,
      placementIds,
      hireProfileIds,
      outsidePipelineCount: outsidePipelineIds.length,
    },
  });
  for (let i = 0; i < uniqueHires.length; i++) {
    const hire = uniqueHires[i]!;
    const profile = profileById.get(hire.profileId)!;
    await logAccess({
      kind: "placement.confirm",
      actor: session.id,
      subject: profile.id,
      meta: {
        orgId: session.orgId,
        handle: profile.handle,
        role: vacancy.title,
        city: profile.city,
        vacancyId: v.vacancyId,
        placementId: placementIds[i],
      },
    });
  }

  // ── Notifications: hired seekers (existing kind) ──────────────────────
  // Same notification body shape as markAsHired() so the seeker's
  // status-confirmation flow on /dashboard works unchanged.
  const orgNameRow = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const orgName = orgNameRow[0]?.name ?? "An employer";

  for (let i = 0; i < uniqueHires.length; i++) {
    const profile = profileById.get(uniqueHires[i]!.profileId)!;
    await createNotification({
      userId: profile.userId,
      kind: "placement.confirmed",
      title: `${orgName} logged you as hired`,
      body: `${vacancy.title} in ${profile.city}. Your status will switch to "employed" once you confirm.`,
      link: "/dashboard",
      meta: {
        orgId: session.orgId,
        orgName,
        role: vacancy.title,
        city: profile.city,
        placementId: placementIds[i],
        vacancyId: v.vacancyId,
      },
    });
  }

  // ── Outcome fan-out: not-selected accepted invitees ───────────────────
  // Per D5: accepted / accepted_with_notice MINUS the hired set.
  // Capped at OUTCOME_FANOUT_CAP per call to bound the email burst.
  const notSelectedProfileIds = Array.from(acceptedProfileIds).filter(
    (id) => !hireProfileIds.includes(id),
  );
  let notSelectedCount = 0;

  if (notSelectedProfileIds.length > 0) {
    const recipients = notSelectedProfileIds.slice(0, OUTCOME_FANOUT_CAP);

    // Pull recipient profiles + skill slugs in two bulk queries.
    const recipientRows = await db
      .select({
        id: schema.profiles.id,
        userId: schema.profiles.userId,
        yearsExperience: schema.profiles.yearsExperience,
      })
      .from(schema.profiles)
      .where(inArray(schema.profiles.id, recipients));

    const skillRows = await db
      .select({
        profileId: schema.profileSkills.profileId,
        skillSlug: schema.profileSkills.skillSlug,
      })
      .from(schema.profileSkills)
      .where(inArray(schema.profileSkills.profileId, recipients));
    const skillsByProfile = new Map<string, string[]>();
    for (const row of skillRows) {
      const list = skillsByProfile.get(row.profileId) ?? [];
      list.push(row.skillSlug);
      skillsByProfile.set(row.profileId, list);
    }

    // Pull dominant decline reason for this (profession × province)
    // cell from the cross-market 9.8.7 aggregate. NULL when below k.
    const declineAgg = await declineReasonAggregateQuery();
    const cellRows = declineAgg.cells.filter(
      (c) =>
        c.profession_slug === vacancy.professionSlug &&
        c.province_slug === vacancy.provinceSlug,
    );
    const dominantDeclineReason: DeclineReasonValue | null = cellRows.length
      ? cellRows.reduce((top, r) => (r.count > top.count ? r : top))
          .reason as DeclineReasonValue
      : null;

    const professionLabel =
      MOCK_PROFESSIONS.find((p) => p.slug === vacancy.professionSlug)?.label ??
      vacancy.professionSlug;

    for (const r of recipientRows) {
      const composerInput: OutcomeComposerInput = {
        orgName,
        vacancyTitle: vacancy.title,
        professionLabel,
        requiredSkillSlugs: vacancy.skillSlugs,
        seniorityLabel: vacancy.seniority,
        recipientSkillSlugs: skillsByProfile.get(r.id) ?? [],
        recipientYearsExperience: r.yearsExperience,
        dominantDeclineReason,
      };
      const composed = composeOutcomeNotification(composerInput);
      await createNotification({
        userId: r.userId,
        kind: "vacancy.outcome.other-hired",
        title: composed.title,
        body: composed.body,
        link: composed.link,
        meta: {
          vacancyId: v.vacancyId,
          orgId: session.orgId,
          missingSkillSlugs: composed.missingSkillSlugs,
        },
      });
      notSelectedCount++;
    }

    // Single batch audit row for the fan-out (per-recipient body is
    // visible in the notifications table; auditing N rows here would
    // double-log without adding traceability).
    await logAccess({
      kind: "vacancy.outcome.other-hired",
      actor: session.id,
      subject: v.vacancyId,
      meta: {
        orgId: session.orgId,
        recipientCount: notSelectedCount,
        capped: notSelectedProfileIds.length > OUTCOME_FANOUT_CAP,
      },
    });
  }

  revalidatePath("/employer/vacancies");
  revalidatePath(`/employer/vacancies/${v.vacancyId}`);
  revalidatePath("/employer/placements");
  revalidatePath("/insights");

  return ok({ placementIds, notSelectedCount });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.11  Outside-pipeline hire typeahead
//
// Used by the MarkAsFilledModal's "I hired someone not in this list"
// expander. Returns a tight (max 5) `SearchResultRow[]` for a typed
// query, scoped to the org's province so the recruiter sees regional
// candidates first. Audit-logged so misuse (scraping) is visible.
// ─────────────────────────────────────────────────────────────────────────────

const typeaheadSchema = z.object({
  vacancyId: z.string().min(1),
  query: z.string().trim().min(2).max(80),
});

export async function searchOutsideHireCandidates(
  input: z.infer<typeof typeaheadSchema>,
): Promise<ActionResult<{ results: SearchResultRow[] }>> {
  const session = await verifyOrgVerified();
  const parsed = typeaheadSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid search input.");
  const { vacancyId, query } = parsed.data;

  // Vacancy must belong to caller's org  prevents probing of another
  // org's candidate pool via this surface.
  const vacancy = await getMyVacancy(vacancyId);
  if (!vacancy) return fail("Vacancy not found in your organisation.");

  // Exclude profiles already on the invitation pipeline for this
  // vacancy  the modal handles those in its primary list.
  const db = getDb();
  const existing = await db
    .select({ profileId: schema.vacancyInvitations.profileId })
    .from(schema.vacancyInvitations)
    .where(eq(schema.vacancyInvitations.vacancyId, vacancyId));
  const excludeHandles = existing.length
    ? (
        await db
          .select({ handle: schema.profiles.handle })
          .from(schema.profiles)
          .where(
            inArray(
              schema.profiles.id,
              existing.map((e) => e.profileId),
            ),
          )
      ).map((r) => r.handle)
    : [];

  // Reuse Phase 4 ranking SQL. Scope to the vacancy's province so
  // typeahead surfaces local candidates first.
  const filters: SearchFilters = {
    query,
    province: vacancy.provinceSlug,
    highlightCitizens: true,
  };
  const { profiles } = await searchProfilesQuery(filters);

  // Cap at 5 + filter out anyone on the invitation pipeline.
  const results = profiles
    .filter((p) => !excludeHandles.includes(p.handle))
    .slice(0, 5);

  await logAccess({
    kind: "search.outside-hire-lookup",
    actor: session.id,
    subject: vacancyId,
    meta: {
      orgId: session.orgId,
      query,
      province: vacancy.provinceSlug,
      resultCount: results.length,
    },
  });

  return ok({ results });
}

const skipSchema = z.object({ vacancyId: z.string().min(1) });

/**
 * Explicit skip path  flip the vacancy state to `filled` without
 * logging any placements. Writes a distinct audit row so admin
 * analytics can spot orgs that habitually skip Placement-Truth.
 *
 * D1 trade-off: keeps the escape hatch open for edge cases (e.g.
 * employer hired someone before joining Sebenza, can't pretend
 * otherwise) without normalising it.
 */
export async function markVacancyFilledNoPlacement(
  input: z.infer<typeof skipSchema>,
): Promise<ActionResult> {
  const guard = await requireEditRole();
  if (!guard.ok) return guard;
  const parsed = skipSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid vacancy id.");
  const { vacancyId } = parsed.data;

  const existing = await getMyVacancy(vacancyId);
  if (!existing) return fail("Vacancy not found in your organisation.");
  if (existing.status !== "open" && existing.status !== "draft") {
    return fail(`Vacancy is already ${existing.status}.`);
  }

  const db = getDb();
  await db
    .update(schema.vacancies)
    .set({
      status: "filled" as const,
      closedAt: new Date(),
    })
    .where(
      and(
        eq(schema.vacancies.id, vacancyId),
        eq(schema.vacancies.organizationId, guard.orgId),
      ),
    );

  await logAccess({
    kind: "org.vacancy.filled.no-placement",
    actor: guard.userId,
    subject: vacancyId,
    meta: { orgId: guard.orgId, prior: existing.status },
  });

  revalidatePath("/employer/vacancies");
  revalidatePath(`/employer/vacancies/${vacancyId}`);
  return ok();
}
