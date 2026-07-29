/**
 * Phase 34  Self Apply: the PUBLIC vacancy read seam
 * (docs/PHASE_34_SELF_APPLY_PLAN.md).
 *
 * This module is the deliberate, documented carve-out of the 9.8.8
 * "vacancies are org-private" contract (see the rewritten doc-comment
 * on `vacancies` in db/schema.ts): a vacancy whose owner switched
 * `selfApplyEnabled` ON exposes a DEFINED SUBSET here, addressed only
 * by its unguessable `selfApplyToken`  never by vacancy id.
 *
 * Hard rules:
 *   - The anonymous payload type (`PublicVacancy`) STRUCTURALLY cannot
 *     carry `salaryBand`  the field does not exist on the type. The
 *     signed-in-seeker salary read is a separate, explicit function
 *     (`getApplicantSalaryBand`) so the two disclosure levels can never
 *     be conflated by a refactor (D2).
 *   - Every read re-checks ALL THREE gates: platform flag, per-vacancy
 *     toggle, vacancy status = open. A typed `unavailable` reason comes
 *     back for every miss  and the page renders the SAME calm panel
 *     for all of them, so a probing client cannot distinguish
 *     bad-token from disabled from closed (no enumeration).
 *   - Plain module (NOT "use server"): these functions are only
 *     callable from server components / actions that import them, the
 *     documented pattern for public reads that must not become HTTP
 *     endpoints (see lib/security/server-action-guards.test.ts notes).
 */

import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";
import { formatVacancyLocation } from "@/lib/employer/vacancies-display";
import type { WorkAvailabilityKind } from "@/lib/mock/types";

/** Unguessable public-link token: 24 random bytes → ~32 base64url chars. */
export function mintSelfApplyToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * D4  the exact disclosure the seeker confirms when applying. The
 * dialog renders the i18n rendition; THIS canonical en string + version
 * go into the audit meta so we can always prove what was agreed to.
 * Bump the version whenever the wording materially changes.
 */
export const SELF_APPLY_DISCLOSURE_VERSION = "v1";
export function selfApplyDisclosure(orgName: string): string {
  return `Applying shares your profile with ${orgName} for this role. They can view your profile and contact you about this vacancy through Sebenza.`;
}

/** The anonymous public subset. NO salaryBand field  see module doc. */
export interface PublicVacancy {
  token: string;
  title: string;
  orgName: string;
  /** Honest badge  organizations.verification as-is. */
  orgVerification: string;
  professionSlug: string;
  /** Display-ready ("Chef")  resolved from the live professions table. */
  professionLabel: string;
  /** NULL = "Any province (remote / hybrid)". */
  provinceSlug: string | null;
  citySlug: string | null;
  /** Display-ready location ("Cape Town, Western Cape" / "Any province  Remote"). */
  locationLabel: string;
  /** Display-ready skills  labels from the live skills table. */
  skills: { slug: string; label: string }[];
  seniority: string | null;
  description: string | null;
  workAvailability: WorkAvailabilityKind[];
  minYearsExperience: number | null;
  minNqfLevel: number | null;
  positions: number | null;
}

export type PublicVacancyResult =
  | { ok: true; vacancy: PublicVacancy }
  | { ok: false; reason: "flag_off" | "not_found" | "disabled" | "not_open" };

/**
 * Load the public subset for /apply/[token]. All-gates read; the
 * caller renders one identical unavailable panel per the no-enumeration
 * rule (the typed reason exists for logging/tests, not for the UI).
 */
export async function getPublicVacancyByToken(
  token: string,
): Promise<PublicVacancyResult> {
  const flagOn = await getSetting<boolean>("feature_flag_vacancy_self_apply");
  if (!flagOn) return { ok: false, reason: "flag_off" };
  if (!token || token.length < 16 || token.length > 128) {
    return { ok: false, reason: "not_found" };
  }

  const db = getDb();
  const rows = await db
    .select({
      title: schema.vacancies.title,
      professionSlug: schema.vacancies.professionSlug,
      provinceSlug: schema.vacancies.provinceSlug,
      citySlug: schema.vacancies.citySlug,
      skillSlugs: schema.vacancies.skillSlugs,
      seniority: schema.vacancies.seniority,
      description: schema.vacancies.description,
      workAvailability: schema.vacancies.workAvailability,
      minYearsExperience: schema.vacancies.minYearsExperience,
      minNqfLevel: schema.vacancies.minNqfLevel,
      positions: schema.vacancies.positions,
      status: schema.vacancies.status,
      selfApplyEnabled: schema.vacancies.selfApplyEnabled,
      orgName: schema.organizations.name,
      orgVerification: schema.organizations.verification,
    })
    .from(schema.vacancies)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.vacancies.organizationId),
    )
    .where(eq(schema.vacancies.selfApplyToken, token))
    .limit(1);

  const v = rows[0];
  if (!v) return { ok: false, reason: "not_found" };
  if (!v.selfApplyEnabled) return { ok: false, reason: "disabled" };
  if (v.status !== "open") return { ok: false, reason: "not_open" };

  // Resolve display labels HERE so pages and the OG card never touch
  // slugs (and never widen the compliance import surface).
  const workAvailability = (v.workAvailability ?? []) as WorkAvailabilityKind[];
  const skillSlugs = v.skillSlugs ?? [];
  const [professionRow, skillRows] = await Promise.all([
    db
      .select({ label: schema.professions.label })
      .from(schema.professions)
      .where(eq(schema.professions.slug, v.professionSlug))
      .limit(1),
    skillSlugs.length > 0
      ? db
          .select({ slug: schema.skills.slug, label: schema.skills.label })
          .from(schema.skills)
          .where(inArray(schema.skills.slug, skillSlugs))
      : Promise.resolve([] as { slug: string; label: string }[]),
  ]);
  const skillLabelMap = new Map(skillRows.map((s) => [s.slug, s.label]));

  return {
    ok: true,
    vacancy: {
      token,
      title: v.title,
      orgName: v.orgName,
      orgVerification: v.orgVerification,
      professionSlug: v.professionSlug,
      professionLabel: professionRow[0]?.label ?? v.professionSlug,
      provinceSlug: v.provinceSlug,
      citySlug: v.citySlug,
      locationLabel: formatVacancyLocation({
        provinceSlug: v.provinceSlug,
        citySlug: v.citySlug,
        workAvailability,
      }),
      skills: skillSlugs.map((slug) => ({
        slug,
        label: skillLabelMap.get(slug) ?? slug,
      })),
      seniority: v.seniority,
      description: v.description,
      workAvailability,
      minYearsExperience: v.minYearsExperience,
      minNqfLevel: v.minNqfLevel,
      positions: v.positions,
    },
  };
}

/**
 * D2  salary band for a SIGNED-IN SEEKER viewing /apply/[token].
 * Returns null unless every gate is open AND the employer left
 * `salaryVisibleToApplicants` on. Callers must only invoke this after
 * establishing the viewer is an authenticated seeker  the page does.
 */
export async function getApplicantSalaryBand(
  token: string,
): Promise<string | null> {
  const flagOn = await getSetting<boolean>("feature_flag_vacancy_self_apply");
  if (!flagOn || !token) return null;
  const db = getDb();
  const rows = await db
    .select({
      salaryBand: schema.vacancies.salaryBand,
      salaryVisibleToApplicants: schema.vacancies.salaryVisibleToApplicants,
      selfApplyEnabled: schema.vacancies.selfApplyEnabled,
      status: schema.vacancies.status,
    })
    .from(schema.vacancies)
    .where(eq(schema.vacancies.selfApplyToken, token))
    .limit(1);
  const v = rows[0];
  if (!v || !v.selfApplyEnabled || v.status !== "open") return null;
  if (!v.salaryVisibleToApplicants) return null;
  return v.salaryBand;
}

/**
 * Viewer state for a signed-in seeker on /apply/[token]: do they
 * already hold a row on this vacancy? Drives the "already applied" /
 * "you're already invited  respond here" panels. Called from the RSC
 * page only (session user id comes from the page's own auth read).
 */
export type SeekerApplyState =
  | { kind: "can_apply" }
  | { kind: "no_profile" }
  | { kind: "already_applied"; invitationId: string }
  | { kind: "already_invited"; invitationId: string; state: string };

export async function getSeekerApplyState(
  token: string,
  seekerUserId: string,
): Promise<SeekerApplyState> {
  const db = getDb();
  const profileRow = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, seekerUserId))
    .limit(1);
  const profileId = profileRow[0]?.id;
  if (!profileId) return { kind: "no_profile" };

  const vacancyRow = await db
    .select({ id: schema.vacancies.id })
    .from(schema.vacancies)
    .where(eq(schema.vacancies.selfApplyToken, token))
    .limit(1);
  const vacancyId = vacancyRow[0]?.id;
  if (!vacancyId) return { kind: "can_apply" };

  const existing = await db
    .select({
      id: schema.vacancyInvitations.id,
      origin: schema.vacancyInvitations.origin,
      state: schema.vacancyInvitations.state,
    })
    .from(schema.vacancyInvitations)
    .where(
      and(
        eq(schema.vacancyInvitations.vacancyId, vacancyId),
        eq(schema.vacancyInvitations.profileId, profileId),
      ),
    )
    .limit(1);
  const row = existing[0];
  if (!row) return { kind: "can_apply" };
  if (row.origin === "self_apply") {
    return { kind: "already_applied", invitationId: row.id };
  }
  return { kind: "already_invited", invitationId: row.id, state: row.state };
}
