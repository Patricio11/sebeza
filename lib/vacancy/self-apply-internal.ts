/**
 * Phase 34 — the single write path for a self-application, shared by:
 *   - `lib/seeker/self-apply.ts` (signed-in seeker on /apply/[token])
 *   - `lib/auth/actions.ts` (application recorded during sign-up from
 *     /sign-up/apply/[token]  the acceptSeekerInvitation precedent:
 *     record at sign-up so nothing is lost before email verification)
 *
 * Plain module (not "use server") — callers own authentication; this
 * owns the invariant that a self-application row is ALWAYS written the
 * same way: origin='self_apply', state='accepted', respondedAt=now,
 * invitedByUserId=NULL, frozen vacancySnapshot, org notification, one
 * `vacancy.self_apply` audit row carrying the D4 disclosure evidence.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { logAccess } from "@/lib/audit";
import { notifyOrgMembers } from "@/lib/notifications/server";
import {
  SELF_APPLY_DISCLOSURE_VERSION,
  selfApplyDisclosure,
} from "./public";

export interface SelfApplyVacancyRow {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  professionSlug: string;
  provinceSlug: string | null;
  citySlug: string | null;
  seniority: string | null;
  skillSlugs: string[];
  workAvailability: string[];
  minYearsExperience: number | null;
  minNqfLevel: number | null;
  salaryBand: string | null;
  salaryVisibleToApplicants: boolean;
  orgName: string;
}

export type RecordSelfApplicationResult =
  | { ok: true; invitationId: string }
  | { ok: false; reason: "duplicate" };

/**
 * Insert the row + notify + audit. Assumes the caller already verified
 * every gate (flag, toggle, open status, seeker ownership, not blocked,
 * no existing row) — the unique (vacancyId, profileId) index is the
 * final referee: a race collapses to `duplicate`, never a double row.
 */
export async function recordSelfApplication(input: {
  vacancy: SelfApplyVacancyRow;
  profileId: string;
  seekerUserId: string;
  source: "existing_account" | "signup";
}): Promise<RecordSelfApplicationResult> {
  const { vacancy, profileId, seekerUserId, source } = input;
  const db = getDb();
  const invitationId = `inv_${randomUUID()}`;

  // Same frozen-spec shape as bulkInviteToVacancy (Phase 11.3.4), with
  // one D2 nuance: when the employer hid salary from applicants, the
  // snapshot the applicant keeps must not reveal it either.
  const vacancySnapshot = {
    title: vacancy.title,
    description: vacancy.description,
    professionSlug: vacancy.professionSlug,
    provinceSlug: vacancy.provinceSlug,
    citySlug: vacancy.citySlug,
    seniority: vacancy.seniority,
    skillSlugs: vacancy.skillSlugs,
    workAvailability: vacancy.workAvailability,
    minYearsExperience: vacancy.minYearsExperience,
    minNqfLevel: vacancy.minNqfLevel,
    salaryBand: vacancy.salaryVisibleToApplicants ? vacancy.salaryBand : null,
    capturedAt: new Date().toISOString(),
  };

  try {
    await db.insert(schema.vacancyInvitations).values({
      id: invitationId,
      vacancyId: vacancy.id,
      profileId,
      invitedByUserId: null,
      origin: "self_apply",
      state: "accepted",
      respondedAt: new Date(),
      expiresAt: null,
      vacancySnapshot,
    });
  } catch {
    // Unique-index violation — concurrent duplicate; the first write won.
    return { ok: false, reason: "duplicate" };
  }

  // Attributed, per-application notification (no dedupe — each
  // applicant is their own event). Display name only; the employer
  // opens the pipeline to review, same as an invite response.
  const seekerRow = await db
    .select({ displayName: schema.profiles.displayName })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1);
  const applicantName = seekerRow[0]?.displayName ?? "A seeker";

  await notifyOrgMembers(vacancy.organizationId, {
    kind: "vacancy.self_apply",
    title: `${applicantName} applied for: ${vacancy.title}`,
    body:
      `They applied through your public Self Apply link and are in the ` +
      `vacancy pipeline as an accepted candidate with a "Self-applied" ` +
      `chip. Review and shortlist them like any invited seeker.`,
    link: `/employer/vacancies/${vacancy.id}`,
    meta: {
      invitationId,
      vacancyId: vacancy.id,
      orgId: vacancy.organizationId,
    },
  });

  await logAccess({
    kind: "vacancy.self_apply",
    actor: seekerUserId,
    subject: vacancy.id,
    meta: {
      invitationId,
      orgId: vacancy.organizationId,
      profileId,
      source,
      // D4 — the audited confirmation IS the consent act for this
      // disclosure; keep the exact wording + version as evidence.
      disclosureVersion: SELF_APPLY_DISCLOSURE_VERSION,
      disclosure: selfApplyDisclosure(vacancy.orgName),
    },
  });

  return { ok: true, invitationId };
}

/**
 * Full vacancy row for the write path, by token, with org join.
 * Separate from the public reader because the writer needs ids +
 * salary + toggle fields the anonymous payload must never carry.
 */
export async function loadSelfApplyVacancyByToken(
  token: string,
): Promise<{ vacancy: SelfApplyVacancyRow; status: string; selfApplyEnabled: boolean } | null> {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: schema.vacancies.id,
      organizationId: schema.vacancies.organizationId,
      title: schema.vacancies.title,
      description: schema.vacancies.description,
      professionSlug: schema.vacancies.professionSlug,
      provinceSlug: schema.vacancies.provinceSlug,
      citySlug: schema.vacancies.citySlug,
      seniority: schema.vacancies.seniority,
      skillSlugs: schema.vacancies.skillSlugs,
      workAvailability: schema.vacancies.workAvailability,
      minYearsExperience: schema.vacancies.minYearsExperience,
      minNqfLevel: schema.vacancies.minNqfLevel,
      salaryBand: schema.vacancies.salaryBand,
      salaryVisibleToApplicants: schema.vacancies.salaryVisibleToApplicants,
      status: schema.vacancies.status,
      selfApplyEnabled: schema.vacancies.selfApplyEnabled,
      orgName: schema.organizations.name,
    })
    .from(schema.vacancies)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.vacancies.organizationId),
    )
    .where(eq(schema.vacancies.selfApplyToken, token))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    vacancy: {
      id: r.id,
      organizationId: r.organizationId,
      title: r.title,
      description: r.description,
      professionSlug: r.professionSlug,
      provinceSlug: r.provinceSlug,
      citySlug: r.citySlug,
      seniority: r.seniority,
      skillSlugs: r.skillSlugs ?? [],
      workAvailability: (r.workAvailability ?? []) as string[],
      minYearsExperience: r.minYearsExperience,
      minNqfLevel: r.minNqfLevel,
      salaryBand: r.salaryBand,
      salaryVisibleToApplicants: r.salaryVisibleToApplicants,
      orgName: r.orgName,
    },
    status: r.status,
    selfApplyEnabled: r.selfApplyEnabled,
  };
}
