"use server";

/**
 * Phase 9.19 Tier 2  per-(vacancy, profile) shortlist actions.
 *
 * Distinct from the Phase 5 cross-vacancy `shortlistPools` (talent pools):
 * a `vacancy_shortlists` row says "save this candidate to come back to
 * on THIS specific vacancy." Scope is the vacancy, not the user (D5).
 *
 * Authorisation: every read + write resolves the caller's org via
 * `verifyEmployer`, then verifies the parent vacancy belongs to that
 * org via `getMyVacancy`. There is no code path here that touches a
 * shortlist for a vacancy that the caller doesn't own.
 *
 * Not a consent surface  no `profile.shortlist.add` audit row is
 * written (that's the talent-pool path). Toggling here is a transient
 * employer-side preference; nothing seeker-visible.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer } from "@/lib/auth/dal";
import { getMyVacancy } from "@/lib/employer/vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const toggleSchema = z.object({
  vacancyId: z.string().min(1),
  profileId: z.string().min(1),
});

/**
 * Resolve session + edit-role + vacancy ownership in one go. Returns
 * `fail(...)` if any check fails; otherwise an `ok` carrying the
 * resolved orgId + userId so the caller can write safely. Viewer role
 * is rejected  shortlist edits are an editor-only affordance (matches
 * the rest of the vacancy lifecycle  Viewers browse but don't
 * mutate).
 */
async function requireEditableVacancy(
  vacancyId: string,
): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; message: string }
> {
  const session = await verifyEmployer();
  if (!session.orgId) {
    return { ok: false, message: "No organisation context." };
  }
  const vacancy = await getMyVacancy(vacancyId);
  if (!vacancy) {
    return { ok: false, message: "Vacancy not found in your organisation." };
  }
  const db = getDb();
  const memberRows = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, session.orgId),
        eq(schema.organizationMembers.userId, session.id),
      ),
    )
    .limit(1);
  const role = memberRows[0]?.role ?? null;
  if (!canEditVacancies(role)) {
    return {
      ok: false,
      message:
        "Your role is read-only for vacancies. Ask an Owner or Recruiter to edit the shortlist.",
    };
  }
  return { ok: true, orgId: session.orgId, userId: session.id };
}

/**
 * Add a profile to this vacancy's shortlist. Idempotent: a second
 * add for the same (vacancy, profile) silently no-ops via the unique
 * index + ON CONFLICT DO NOTHING. No audit kind  shortlists are a
 * transient employer preference.
 */
export async function addToVacancyShortlist(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid shortlist input.");
  const { vacancyId, profileId } = parsed.data;

  const guard = await requireEditableVacancy(vacancyId);
  if (!guard.ok) return guard;

  const db = getDb();
  await db
    .insert(schema.vacancyShortlists)
    .values({
      id: `vsl_${randomUUID()}`,
      vacancyId,
      profileId,
      addedByUserId: guard.userId,
    })
    .onConflictDoNothing({
      target: [
        schema.vacancyShortlists.vacancyId,
        schema.vacancyShortlists.profileId,
      ],
    });

  revalidatePath(`/employer/vacancies/${vacancyId}/match`);
  return ok();
}

/**
 * Remove a profile from this vacancy's shortlist. Idempotent: a
 * delete that matches no rows is a successful no-op.
 */
export async function removeFromVacancyShortlist(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid shortlist input.");
  const { vacancyId, profileId } = parsed.data;

  const guard = await requireEditableVacancy(vacancyId);
  if (!guard.ok) return guard;

  const db = getDb();
  await db
    .delete(schema.vacancyShortlists)
    .where(
      and(
        eq(schema.vacancyShortlists.vacancyId, vacancyId),
        eq(schema.vacancyShortlists.profileId, profileId),
      ),
    );

  revalidatePath(`/employer/vacancies/${vacancyId}/match`);
  return ok();
}

/**
 * Load every profile id on this vacancy's shortlist. Returns a Set
 * so the match-page renderer can do O(1) membership tests per row.
 * Empty set when the caller has no org context, the vacancy isn't
 * theirs, or the shortlist is empty  the page treats all three as
 * "nothing to highlight" without leaking which case it was.
 */
export async function getVacancyShortlistProfileIds(
  vacancyId: string,
): Promise<Set<string>> {
  const session = await verifyEmployer();
  if (!session.orgId) return new Set();
  const vacancy = await getMyVacancy(vacancyId);
  if (!vacancy) return new Set();
  const db = getDb();
  const rows = await db
    .select({ profileId: schema.vacancyShortlists.profileId })
    .from(schema.vacancyShortlists)
    .where(eq(schema.vacancyShortlists.vacancyId, vacancyId));
  return new Set(rows.map((r) => r.profileId));
}
