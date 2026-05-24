"use server";

/**
 * Phase 5  Placement confirmation. The data-quality lever.
 *
 * Placement-Truth Rule (`TO_START_EVERY_SESSION.md §8`): analytics only
 * count a hire when the employer logs it on Sebenza. Self-reported
 * status ≠ a confirmed placement. This is the difference between Sebenza
 * being a directory and Sebenza being a national talent-intelligence
 * system.
 *
 * Gate (`docs/PHASE_5_PLAN.md` re-check #4):
 *   The employer must have revealed this candidate's contact in the last
 *   30 days. We look up the audit_log for a prior `profile.contact.reveal`
 *   event with subject = profileId AND meta->>orgId = orgId. Without one,
 *   marking a hire is rejected  you can't log a placement for someone
 *   whose details you never saw.
 *
 * Side-effects:
 *   - Inserts a `placements` row with actorUserId set
 *   - Audit-logs `placement.confirm` with role + city
 *   - Phase 8 wires the seeker notification email here
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer, verifyOrgVerified } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const REVEAL_GATE_DAYS = 30;

const markAsHiredSchema = z.object({
  handle: z.string().min(1),
  role: z.string().min(2).max(160),
  city: z.string().min(1).max(80),
  hiredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  /** Optional, kept private  never in any public read. */
  salaryBand: z.string().max(80).optional(),
  /**
   * Phase 9.8.6  optional linkage to the vacancy whose pipeline
   * produced this hire. NULL when the hire was logged directly
   * (Phase 5 flow). When set, the action verifies the vacancy belongs
   * to the caller's org before writing  cross-org vacancy_id values
   * are silently nulled out, never just trusted.
   */
  vacancyId: z.string().min(1).optional(),
});

export async function markAsHired(
  input: z.infer<typeof markAsHiredSchema>,
): Promise<ActionResult<{ placementId: string }>> {
  const session = await verifyOrgVerified();
  const parsed = markAsHiredSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");
  const v = parsed.data;

  const db = getDb();

  // Resolve the profile by handle.
  const profileRows = await db
    .select({
      id: schema.profiles.id,
      displayName: schema.profiles.displayName,
      userId: schema.profiles.userId,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, v.handle))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return fail("Profile not found.");

  // Gate: must have revealed contact in the last 30 days for THIS org.
  // We look up the audit_log directly  single source of truth for who
  // saw whose contact and when.
  const since = new Date(Date.now() - REVEAL_GATE_DAYS * 24 * 60 * 60 * 1000);
  const reveals = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.kind, "profile.contact.reveal"),
        eq(schema.auditLog.subject, profile.id),
        sql`${schema.auditLog.at} >= ${since}`,
        sql`${schema.auditLog.meta}->>'orgId' = ${session.orgId}`,
      ),
    );
  const recentReveals = reveals[0]?.count ?? 0;
  if (recentReveals === 0) {
    return fail(
      "You need to reveal this candidate's contact within the last 30 days before logging a hire. Open their dossier first.",
    );
  }

  // Phase 9.8.6  resolve + verify vacancy linkage, if any. We accept
  // cross-org vacancy_id values silently (null them out) rather than
  // failing the action  prevents an attacker from probing for the
  // existence of another org's vacancy via the placement form.
  let safeVacancyId: string | null = null;
  if (v.vacancyId) {
    const vacancyRows = await db
      .select({ id: schema.vacancies.id })
      .from(schema.vacancies)
      .where(
        and(
          eq(schema.vacancies.id, v.vacancyId),
          eq(schema.vacancies.organizationId, session.orgId),
        ),
      )
      .limit(1);
    if (vacancyRows[0]) safeVacancyId = vacancyRows[0].id;
  }

  const id = `plc_${randomUUID()}`;
  await db.insert(schema.placements).values({
    id,
    profileId: profile.id,
    organizationId: session.orgId,
    actorUserId: session.id,
    role: v.role,
    city: v.city,
    hiredAt: v.hiredAt ? new Date(v.hiredAt) : new Date(),
    salaryBand: v.salaryBand ?? null,
    // Phase 7.5  explicit. Only employer-confirmed placements count
    // in official analytics + the Phase 7.5.4 outcomes dataset.
    source: "employer_confirmed",
    vacancyId: safeVacancyId,
  });

  await logAccess({
    kind: "placement.confirm",
    actor: session.id,
    subject: profile.id,
    meta: {
      orgId: session.orgId,
      handle: v.handle,
      role: v.role,
      city: v.city,
      ...(safeVacancyId ? { vacancyId: safeVacancyId } : {}),
    },
  });

  const orgNameRow = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const orgName = orgNameRow[0]?.name ?? "An employer";

  await createNotification({
    userId: profile.userId,
    kind: "placement.confirmed",
    title: `${orgName} logged you as hired`,
    body: `${v.role} in ${v.city}. Your status will switch to "employed" once you confirm.`,
    link: "/dashboard",
    meta: {
      orgId: session.orgId,
      orgName,
      role: v.role,
      city: v.city,
      placementId: id,
    },
  });

  revalidatePath("/employer/placements");
  revalidatePath(`/employer/dossier/${v.handle}`);
  revalidatePath("/insights"); // ISR triggers recompute next visit

  return ok({ placementId: id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.8.6  read helper for the vacancy detail panel.
// ─────────────────────────────────────────────────────────────────────────────

export interface VacancyPlacementRow {
  id: string;
  profileId: string;
  handle: string;
  displayName: string;
  role: string;
  city: string;
  hiredAt: string;
  salaryBand: string | null;
  source: string;
}

/**
 * Every placement linked to the given vacancy, newest hire first.
 * Joins to `profiles` for the display name + handle. Org-scoping is
 * enforced by both the parent vacancy's organisation_id AND the
 * placement's organisation_id (defence in depth).
 *
 * Caller is responsible for the prior org-ownership check on the
 * vacancy (the vacancy detail page passes a vacancy already loaded
 * via `getMyVacancy()`). The query still filters by
 * `placements.organizationId = session.orgId` so a leaked vacancyId
 * cross-org join can't smuggle rows through.
 */
export async function getPlacementsForVacancy(
  vacancyId: string,
): Promise<VacancyPlacementRow[]> {
  // Use the permissive guard: this is a READ that scopes by the
  // caller's orgId. An unverified employer with no placements gets
  // back []; cross-org leakage is impossible because the SQL filters
  // on placements.organizationId. The hard `verifyOrgVerified()`
  // gate is reserved for writes (`markAsHired`, `deletePlacement`)
  // and PII-reveal flows. Without this distinction, surfacing
  // placements on the vacancy detail page would redirect any
  // unverified employer away from a page they're meant to see.
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: schema.placements.id,
      profileId: schema.placements.profileId,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      role: schema.placements.role,
      city: schema.placements.city,
      hiredAt: schema.placements.hiredAt,
      salaryBand: schema.placements.salaryBand,
      source: schema.placements.source,
    })
    .from(schema.placements)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.placements.profileId),
    )
    .where(
      and(
        eq(schema.placements.vacancyId, vacancyId),
        eq(schema.placements.organizationId, session.orgId),
      ),
    )
    .orderBy(sql`${schema.placements.hiredAt} DESC`);

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profileId,
    handle: r.handle,
    displayName: r.displayName,
    role: r.role,
    city: r.city,
    hiredAt:
      r.hiredAt instanceof Date
        ? r.hiredAt.toISOString()
        : new Date(r.hiredAt).toISOString(),
    salaryBand: r.salaryBand,
    source: r.source,
  }));
}

export async function deletePlacement(input: {
  placementId: string;
}): Promise<ActionResult> {
  const session = await verifyOrgVerified();
  if (!input?.placementId) return fail("Missing placement id.");
  const db = getDb();

  // Scope deletion to this org  never delete another org's placement.
  const rows = await db
    .select({
      id: schema.placements.id,
      profileId: schema.placements.profileId,
    })
    .from(schema.placements)
    .where(
      and(
        eq(schema.placements.id, input.placementId),
        eq(schema.placements.organizationId, session.orgId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Placement not found.");

  await db.delete(schema.placements).where(eq(schema.placements.id, row.id));

  await logAccess({
    kind: "placement.delete",
    actor: session.id,
    subject: row.profileId,
    meta: { orgId: session.orgId, placementId: row.id },
  });

  revalidatePath("/employer/placements");
  revalidatePath("/insights");

  return ok();
}
