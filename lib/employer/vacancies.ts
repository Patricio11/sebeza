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
import { createNotification, notifyAllAdmins } from "@/lib/notifications/server";
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
import { vacancyProvinceBucket } from "@/lib/employer/vacancies-display";
import type {
  SearchFilters,
  SeasonalWindow,
  Seniority,
  WorkAvailabilityKind,
} from "@/lib/mock/types";
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

/**
 * Phase 9.21  defensive paired-month helper. Returns the column's
 * own value if BOTH paired months are set, NULL otherwise. The Zod
 * refine() catches partial windows at the action boundary; this is
 * the belt to that braces so an unrelated bug can't write a half-
 * window directly to Postgres.
 */
function pairedMonth(
  own: number | null | undefined,
  pair: number | null | undefined,
): number | null {
  if (own == null || pair == null) return null;
  return own;
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
  /**
   * Phase 13.9  nullable. NULL = "Any province (remote / hybrid)".
   * Only valid when workAvailability includes 'remote' or 'hybrid';
   * createVacancy + updateVacancy enforce the cross-column rule.
   */
  provinceSlug: string | null;
  citySlug: string | null;
  skillSlugs: string[];
  seniority: string | null;
  salaryBand: string | null;
  description: string | null;
  documentsRequired: string[];
  status: VacancyStatus;
  inviteExpiryDays: number | null;
  /** Phase 9.19  what work modes / employment types the role offers.
   *  Empty array = "no constraint" (matcher ignores this axis). */
  workAvailability: WorkAvailabilityKind[];
  /** Phase 9.19  minimum total years of experience. NULL = "no floor"
   *  (matcher does NOT check this axis at all  not "0 years or more"). */
  minYearsExperience: number | null;
  /** Phase 9.19  minimum NQF level on the seeker's highest academic
   *  record. NULL = "no floor" (the role does not require a credential,
   *  e.g. trades / hospitality / casual labour / sales). */
  minNqfLevel: number | null;
  /** Phase 9.19 D8  opt-in 7-day follow-up nudges. Default false; the
   *  nightly cron only runs against vacancies that have it set. */
  followUpNudgesEnabled: boolean;
  /** Phase 9.21  optional season window. Always either fully present
   *  or NULL  the read mapper folds "one set, one NULL" to NULL so
   *  consumers never see a partial window. Only meaningful when
   *  workAvailability includes 'seasonal'. */
  seasonalWindow: SeasonalWindow | null;
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
    // Phase 13.9  may be null = "Any province".
    provinceSlug: r.provinceSlug ?? null,
    citySlug: r.citySlug ?? null,
    skillSlugs: r.skillSlugs ?? [],
    seniority: r.seniority ?? null,
    salaryBand: r.salaryBand ?? null,
    description: r.description ?? null,
    documentsRequired: r.documentsRequired ?? [],
    status: r.status as VacancyStatus,
    inviteExpiryDays: r.inviteExpiryDays ?? null,
    workAvailability: (r.workAvailability ?? []) as WorkAvailabilityKind[],
    minYearsExperience: r.minYearsExperience ?? null,
    minNqfLevel: r.minNqfLevel ?? null,
    followUpNudgesEnabled: r.followUpNudgesEnabled ?? false,
    // Phase 9.21  fold "one month set, the other NULL" to NULL so
    // consumers never have to defend against half-windows. The action
    // layer never writes a partial window, but legacy / hand-edited
    // rows could exist; this is the read-side guard.
    seasonalWindow:
      r.seasonalWindowStartMonth != null && r.seasonalWindowEndMonth != null
        ? {
            startMonth: r.seasonalWindowStartMonth,
            endMonth: r.seasonalWindowEndMonth,
            startYear: r.seasonalWindowStartYear ?? null,
            endYear: r.seasonalWindowEndYear ?? null,
            recurringAnnually: r.seasonalWindowRecurringAnnually ?? true,
          }
        : null,
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
 * Phase 13.8  open vacancies belonging to the caller's org, for the
 * inverse-direction invite flow on `/search` (single profile  pick
 * one of MY open vacancies). Excludes draft / closed / filled so the
 * picker only ever lists rows that actually accept new invites.
 *
 * Returns minimal columns the picker needs (id + title + status); the
 * full `VacancyRow` shape is heavier than necessary for the picker
 * UI. Empty array when the caller has no org context. Org-scoped
 * via `verifyEmployer()`  same privacy invariant as `listMyVacancies`.
 */
export interface OpenVacancyOption {
  id: string;
  title: string;
  professionSlug: string;
  /** Phase 13.9  may be null = "Any province (remote / hybrid)". */
  provinceSlug: string | null;
  /** Phase 13.9  picker subtitle needs work-mode awareness to render
   *  "Any province · Remote / Hybrid" correctly. */
  workAvailability: WorkAvailabilityKind[];
}

export async function listMyOrgOpenVacancies(): Promise<OpenVacancyOption[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: schema.vacancies.id,
      title: schema.vacancies.title,
      professionSlug: schema.vacancies.professionSlug,
      provinceSlug: schema.vacancies.provinceSlug,
      workAvailability: schema.vacancies.workAvailability,
    })
    .from(schema.vacancies)
    .where(
      and(
        eq(schema.vacancies.organizationId, session.orgId),
        eq(schema.vacancies.status, "open"),
      ),
    )
    .orderBy(desc(schema.vacancies.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    professionSlug: r.professionSlug,
    provinceSlug: r.provinceSlug,
    workAvailability: (r.workAvailability ?? []) as WorkAvailabilityKind[],
  }));
}

/**
 * Phase 13.8  builds a `profileId  vacancyIds[]` map covering every
 * active invitation across the caller's open vacancies. The
 * <InviteFromSearchButton> modal uses it to gray out the vacancies a
 * given profile is already on so the employer doesn't waste a click.
 *
 * "Active" = states that still occupy a vacancy slot in the
 * employer's mental model: `invited` + `reconsidering` +
 * `accepted_with_notice`. `accepted` (already hired) + `declined` +
 * `withdrawn` + `expired` are NOT active; re-inviting after those
 * is a deliberate employer action so we don't pre-block them at the
 * UX layer (the DB unique constraint still prevents the literal
 * duplicate row, but accepted/declined invites stay in history).
 *
 * Empty map when caller has no org context.
 */
export async function activeInvitationsByProfileForMyOrg(
  profileIds: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (profileIds.length === 0) return map;
  const session = await verifyEmployer();
  if (!session.orgId) return map;

  const db = getDb();
  const rows = await db
    .select({
      profileId: schema.vacancyInvitations.profileId,
      vacancyId: schema.vacancyInvitations.vacancyId,
      state: schema.vacancyInvitations.state,
    })
    .from(schema.vacancyInvitations)
    .innerJoin(
      schema.vacancies,
      eq(schema.vacancyInvitations.vacancyId, schema.vacancies.id),
    )
    .where(
      and(
        eq(schema.vacancies.organizationId, session.orgId),
        eq(schema.vacancies.status, "open"),
        inArray(schema.vacancyInvitations.profileId, profileIds),
        inArray(schema.vacancyInvitations.state, [
          "invited",
          "reconsidering",
          "accepted_with_notice",
        ]),
      ),
    );
  for (const r of rows) {
    const set = map.get(r.profileId);
    if (set) set.add(r.vacancyId);
    else map.set(r.profileId, new Set([r.vacancyId]));
  }
  return map;
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

const WORK_AVAILABILITY_VALUES = [
  "casual",
  "part_time",
  "contract",
  "full_time",
  "remote",
  "hybrid",
  // Phase 9.21  seasonal joins the same array-overlap match. The
  // associated date-range lives on the seasonalWindow* fields below.
  "seasonal",
] as const satisfies readonly WorkAvailabilityKind[];

const vacancyInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  professionSlug: z.string().min(1),
  /**
   * Phase 13.9  nullable. NULL = "Any province (remote / hybrid)".
   * The cross-column refine() below enforces:
   *   (a) NULL province requires `remote` or `hybrid` in
   *       `workAvailability` (D2).
   *   (b) NULL province forces `citySlug` to also be NULL (D3).
   */
  provinceSlug: z.string().min(1).nullable(),
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
  /** Phase 9.19 D0/D1  work modes / employment types the role offers.
   *  Empty array (the default) = no constraint; matcher ignores this axis. */
  workAvailability: z
    .array(z.enum(WORK_AVAILABILITY_VALUES))
    .max(WORK_AVAILABILITY_VALUES.length)
    .optional(),
  /** Phase 9.19 D2  hard floor on total years of experience.
   *  NULL / omitted = "no floor", matcher does not check this axis. */
  minYearsExperience: z.coerce
    .number()
    .int()
    .min(0)
    .max(60)
    .nullable()
    .optional(),
  /** Phase 9.19 D3  minimum NQF level (1-10) on the seeker's highest
   *  academic record. NULL / omitted = no NQF check at all; every
   *  seeker passes regardless of whether they hold a credential. */
  minNqfLevel: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .nullable()
    .optional(),
  /** Phase 9.19 D8  opt-in follow-up nudge cron. Omitted = leave the
   *  current value alone (no surprise toggle on partial form payloads
   *  from older clients). */
  followUpNudgesEnabled: z.boolean().optional(),
  /**
   * Phase 9.21  optional season window when workAvailability
   * includes 'seasonal'. NULL = "seasonal work, timing TBD" per D0.
   * The two month fields are 1-12 and must BOTH be set or BOTH be
   * NULL; the refine() below enforces the pairing. Year-wrap
   * (start > end) is legal per D4.
   */
  seasonalWindowStartMonth: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .nullable()
    .optional(),
  seasonalWindowEndMonth: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .nullable()
    .optional(),
  /**
   * Phase 9.21 follow-up  optional anchor years. When set, the form
   * surfaces them alongside the month for unambiguous summer-season
   * windows (e.g. Nov 2026  Feb 2027). For recurring vacancies,
   * year = first occurrence. Bounded by reasonable past/future so
   * typo'd four-digit years don't escape (e.g. year 20206).
   */
  seasonalWindowStartYear: z.coerce
    .number()
    .int()
    .min(2020)
    .max(2099)
    .nullable()
    .optional(),
  seasonalWindowEndYear: z.coerce
    .number()
    .int()
    .min(2020)
    .max(2099)
    .nullable()
    .optional(),
  seasonalWindowRecurringAnnually: z.boolean().nullable().optional(),
})
.refine(
  (v) => {
    const start = v.seasonalWindowStartMonth ?? null;
    const end = v.seasonalWindowEndMonth ?? null;
    // Both set or both unset; never one of each (D3 pairing rule).
    if ((start === null) !== (end === null)) return false;
    return true;
  },
  {
    message:
      "Set both the start and end month of the seasonal window, or leave both blank.",
    path: ["seasonalWindowEndMonth"],
  },
)
.refine(
  (v) => {
    // Phase 13.9 D2  NULL province (Any) requires the work-mode
    // gate. The form's state-convergence + sentinel removal prevent
    // this combination in steady state, but a client that bypasses
    // the form (curl, scripted submit) must be refused server-side.
    if (v.provinceSlug !== null) return true;
    const wa = v.workAvailability ?? [];
    return wa.includes("remote") || wa.includes("hybrid");
  },
  {
    message:
      "Any province is only allowed when the vacancy is remote or hybrid.",
    path: ["provinceSlug"],
  },
)
.refine(
  (v) => {
    // Phase 13.9 D3  Any province implies Any city. The form clears
    // city on the picker; the server-side refuse covers the same
    // bypass-the-form case.
    if (v.provinceSlug !== null) return true;
    return v.citySlug == null;
  },
  {
    message:
      "A vacancy with Any province cannot pin a specific city.",
    path: ["citySlug"],
  },
);

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

  // Phase 10 follow-up  split skill_slugs into canonical (matcher-
  // visible) + pending (submitted to admin queue, not stored on the
  // vacancy). Mirrors the seeker-side filter in updateSkills.
  const { canonical: canonicalVacancySkills, pending: pendingVacancySkills } =
    splitCanonicalSkills(v.skillSlugs ?? []);

  await db.insert(schema.vacancies).values({
    id,
    organizationId: guard.orgId,
    createdByUserId: guard.userId,
    title: v.title,
    professionSlug: v.professionSlug,
    provinceSlug: v.provinceSlug,
    citySlug: v.citySlug ?? null,
    skillSlugs: canonicalVacancySkills,
    seniority: v.seniority ?? null,
    salaryBand: v.salaryBand ?? null,
    description: v.description ?? null,
    documentsRequired: v.documentsRequired ?? [],
    status: "draft" as const,
    inviteExpiryDays: v.inviteExpiryDays ?? null,
    workAvailability: v.workAvailability ?? [],
    minYearsExperience: v.minYearsExperience ?? null,
    minNqfLevel: v.minNqfLevel ?? null,
    followUpNudgesEnabled: v.followUpNudgesEnabled ?? false,
    // Phase 9.21  the refine() above guarantees these are paired;
    // we still defensively null both together so an unrelated bug
    // can't write a half-window.
    seasonalWindowStartMonth: pairedMonth(v.seasonalWindowStartMonth, v.seasonalWindowEndMonth),
    seasonalWindowEndMonth: pairedMonth(v.seasonalWindowEndMonth, v.seasonalWindowStartMonth),
    // Phase 9.21 follow-up  optional year anchors. Only persisted
    // alongside a valid month window; null otherwise so half-states
    // don't accumulate.
    seasonalWindowStartYear:
      v.seasonalWindowStartMonth != null && v.seasonalWindowEndMonth != null
        ? v.seasonalWindowStartYear ?? null
        : null,
    seasonalWindowEndYear:
      v.seasonalWindowStartMonth != null && v.seasonalWindowEndMonth != null
        ? v.seasonalWindowEndYear ?? null
        : null,
    seasonalWindowRecurringAnnually:
      v.seasonalWindowStartMonth != null && v.seasonalWindowEndMonth != null
        ? v.seasonalWindowRecurringAnnually ?? true
        : null,
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

  // Phase 10 follow-up  if the employer picked "Other" on the
  // profession combobox, the value isn't a canonical slug. Submit a
  // taxonomy suggestion so admins can promote (same pattern as the
  // seeker sign-up + profile-editor flows). Vacancy still saves
  // even when the slug is non-canonical; the matcher just returns
  // empty results until admin promotes. Auxiliary  failure logs
  // but doesn't tank the create.
  await maybeSubmitProfessionSuggestion({
    professionSlug: v.professionSlug,
    actorUserId: guard.userId,
    via: "vacancy-create",
  });

  // Phase 10 follow-up  submit skill suggestions for any "Other"
  // entries the employer typed. The non-canonical slugs were
  // filtered out of the vacancy row above so they don't affect
  // matching; here we hand them to the admin queue.
  for (const slug of pendingVacancySkills) {
    await maybeSubmitSkillSuggestion({
      skillSlug: slug,
      actorUserId: guard.userId,
      via: "vacancy-create",
    });
  }

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

  // Phase 10 follow-up  mirror createVacancy: filter non-canonical
  // skills out of the vacancy row + submit them to the admin queue
  // post-update.
  const { canonical: canonicalUpdateSkills, pending: pendingUpdateSkills } =
    splitCanonicalSkills(v.skillSlugs ?? []);

  await db
    .update(schema.vacancies)
    .set({
      title: v.title,
      professionSlug: v.professionSlug,
      provinceSlug: v.provinceSlug,
      citySlug: v.citySlug ?? null,
      skillSlugs: canonicalUpdateSkills,
      seniority: v.seniority ?? null,
      salaryBand: v.salaryBand ?? null,
      description: v.description ?? null,
      documentsRequired: v.documentsRequired ?? [],
      inviteExpiryDays: v.inviteExpiryDays ?? null,
      workAvailability: v.workAvailability ?? [],
      minYearsExperience: v.minYearsExperience ?? null,
      minNqfLevel: v.minNqfLevel ?? null,
      // Phase 9.19  Zod `optional()` lets the patch omit this; we only
      // overwrite the column when the form actually included a value.
      ...(v.followUpNudgesEnabled !== undefined
        ? { followUpNudgesEnabled: v.followUpNudgesEnabled }
        : {}),
      // Phase 9.21  paired-month guard mirrors the create insert.
      seasonalWindowStartMonth: pairedMonth(v.seasonalWindowStartMonth, v.seasonalWindowEndMonth),
      seasonalWindowEndMonth: pairedMonth(v.seasonalWindowEndMonth, v.seasonalWindowStartMonth),
      seasonalWindowStartYear:
        v.seasonalWindowStartMonth != null && v.seasonalWindowEndMonth != null
          ? v.seasonalWindowStartYear ?? null
          : null,
      seasonalWindowEndYear:
        v.seasonalWindowStartMonth != null && v.seasonalWindowEndMonth != null
          ? v.seasonalWindowEndYear ?? null
          : null,
      seasonalWindowRecurringAnnually:
        v.seasonalWindowStartMonth != null && v.seasonalWindowEndMonth != null
          ? v.seasonalWindowRecurringAnnually ?? true
          : null,
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

  // Phase 10 follow-up  mirrors createVacancy: if the picker emitted
  // a non-canonical profession, queue an admin suggestion. Only fires
  // when the profession actually changed (or wasn't canonical before).
  if (v.professionSlug !== existing.professionSlug) {
    await maybeSubmitProfessionSuggestion({
      professionSlug: v.professionSlug,
      actorUserId: guard.userId,
      via: "vacancy-update",
    });
  }

  // Phase 10 follow-up  pending skill suggestions for any "Other"
  // entries on this edit.
  for (const slug of pendingUpdateSkills) {
    await maybeSubmitSkillSuggestion({
      skillSlug: slug,
      actorUserId: guard.userId,
      via: "vacancy-update",
    });
  }

  revalidatePath("/employer/vacancies");
  revalidatePath(`/employer/vacancies/${vacancyId}`);
  return ok();
}

/**
 * Phase 10 follow-up  shared helper for both createVacancy +
 * updateVacancy. If the picker value isn't in the canonical
 * PROFESSIONS taxonomy, write one taxonomy_suggestions row + notify
 * admins via the existing /admin/taxonomy queue. Auxiliary: failure
 * is logged but never tanks the parent action.
 */
async function maybeSubmitProfessionSuggestion(args: {
  professionSlug: string;
  actorUserId: string;
  via: "vacancy-create" | "vacancy-update";
}): Promise<void> {
  const { professionSlug, actorUserId, via } = args;
  const isCanonical = MOCK_PROFESSIONS.some(
    (p) => p.slug === professionSlug || p.label.toLowerCase() === professionSlug.toLowerCase(),
  );
  if (isCanonical) return;
  const db = getDb();
  try {
    const suggestionId = `tx_${randomUUID()}`;
    await db.insert(schema.taxonomySuggestions).values({
      id: suggestionId,
      kind: "profession",
      customText: professionSlug,
      submittedByUserId: actorUserId,
    });
    await logAccess({
      kind: "taxonomy.suggestion.submit",
      actor: actorUserId,
      subject: suggestionId,
      meta: { kind: "profession", customText: professionSlug, via },
    });
    await notifyAllAdmins({
      kind: "taxonomy.suggestion.received",
      title: `New profession suggestion: ${professionSlug}`,
      body: `An employer picked "Other" while ${via === "vacancy-create" ? "creating" : "editing"} a vacancy + entered "${professionSlug}". Review at /admin/taxonomy.`,
      link: "/admin/taxonomy",
      dedupeKey: `profession::${professionSlug.toLowerCase()}`,
      meta: { suggestionId, kind: "profession", customText: professionSlug },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[vacancies] profession suggestion submit failed:", e);
  }
}

/**
 * Phase 10 follow-up  partition a vacancy skill list into canonical
 * (in the SKILLS taxonomy) + pending (free-text "Other" entries the
 * employer typed via the multi-select). Pending entries are stripped
 * from the persisted vacancy row + handed to the admin queue
 * separately.
 */
function splitCanonicalSkills(skillSlugs: string[]): {
  canonical: string[];
  pending: string[];
} {
  const validSet = new Set(MOCK_SKILLS.map((s) => s.slug));
  const canonical: string[] = [];
  const pending: string[] = [];
  for (const slug of skillSlugs) {
    if (validSet.has(slug)) canonical.push(slug);
    else pending.push(slug);
  }
  return { canonical, pending };
}

/**
 * Phase 10 follow-up  mirror of maybeSubmitProfessionSuggestion for
 * the new skill-suggestion path. Writes one taxonomy_suggestions row
 * + notifies admins. The non-canonical slug is NOT stored on the
 * vacancy (the matcher would treat it as a no-match), so the
 * suggestion-then-promote flow is the only way it lands on the
 * vacancy after admin approval.
 */
async function maybeSubmitSkillSuggestion(args: {
  skillSlug: string;
  actorUserId: string;
  via: "vacancy-create" | "vacancy-update";
}): Promise<void> {
  const { skillSlug, actorUserId, via } = args;
  const db = getDb();
  try {
    const suggestionId = `tx_${randomUUID()}`;
    await db.insert(schema.taxonomySuggestions).values({
      id: suggestionId,
      kind: "skill",
      customText: skillSlug,
      submittedByUserId: actorUserId,
    });
    await logAccess({
      kind: "taxonomy.suggestion.submit",
      actor: actorUserId,
      subject: suggestionId,
      meta: { kind: "skill", customText: skillSlug, via },
    });
    await notifyAllAdmins({
      kind: "taxonomy.suggestion.received",
      title: `New skill suggestion: ${skillSlug}`,
      body: `An employer picked "Other" while ${via === "vacancy-create" ? "creating" : "editing"} a vacancy + entered "${skillSlug}". Review at /admin/taxonomy.`,
      link: "/admin/taxonomy",
      dedupeKey: `skill::${skillSlug.toLowerCase()}`,
      meta: { suggestionId, kind: "skill", customText: skillSlug },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[vacancies] skill suggestion submit failed:", e);
  }
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
    // Phase 9.19  D0/D1/D2/D3: vacancy is the source of truth.
    // Empty array / NULL means the matcher does not constrain on that
    // axis. The query layer (searchProfilesQuery) treats absent fields
    // as "no filter," so we only forward what the vacancy actually asks.
    availableFor:
      vacancy.workAvailability.length > 0
        ? vacancy.workAvailability
        : undefined,
    minYearsExperience: vacancy.minYearsExperience,
    minNqfLevel: vacancy.minNqfLevel,
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
    //
    // Phase 13.9 D5  null-province vacancies are bucketed under the
    // 'national-remote' sentinel by `declineReasonAggregateQuery`.
    // Translate via `vacancyProvinceBucket` so the lookup hits the
    // correct lane in both directions.
    const declineAgg = await declineReasonAggregateQuery();
    const vacancyBucketKey = vacancyProvinceBucket(vacancy.provinceSlug);
    const cellRows = declineAgg.cells.filter(
      (c) =>
        c.profession_slug === vacancy.professionSlug &&
        c.province_slug === vacancyBucketKey,
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
