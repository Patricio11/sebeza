"use server";

/**
 * Phase 5 — Placement confirmation. The data-quality lever.
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
 *   marking a hire is rejected — you can't log a placement for someone
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
import { verifyOrgVerified } from "@/lib/auth/dal";
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
  /** Optional, kept private — never in any public read. */
  salaryBand: z.string().max(80).optional(),
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
  // We look up the audit_log directly — single source of truth for who
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

export async function deletePlacement(input: {
  placementId: string;
}): Promise<ActionResult> {
  const session = await verifyOrgVerified();
  if (!input?.placementId) return fail("Missing placement id.");
  const db = getDb();

  // Scope deletion to this org — never delete another org's placement.
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
