"use server";

/**
 * Phase 7 — Admin verification queue actions.
 *
 * Flips `qualifications.verification` and `organizations.verification`
 * between `unverified`/`pending` → `verified`/`rejected`. Every flip
 * audit-logs with `meta.reason` so a future admin reviewing the trail
 * sees the decision context.
 *
 * All actions require `verifyAdmin()`. Rejection requires a reason
 * (≥10 chars) so admins have to explain themselves; approvals don't.
 *
 * Phase 7 Task 7.6 will fan out notifications from each of these to the
 * affected seeker / org members.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification, notifyOrgMembers } from "@/lib/notifications/server";

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
// Qualifications
// ─────────────────────────────────────────────────────────────────────────────

const approveQualSchema = z.object({
  qualificationId: z.string().min(1),
  note: z.string().max(280).optional(),
});

export async function approveQualification(
  input: z.infer<typeof approveQualSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = approveQualSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.qualifications.id,
      profileId: schema.qualifications.profileId,
      title: schema.qualifications.title,
      ownerUserId: schema.profiles.userId,
    })
    .from(schema.qualifications)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.qualifications.profileId),
    )
    .where(eq(schema.qualifications.id, parsed.data.qualificationId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Qualification not found.");

  await db
    .update(schema.qualifications)
    .set({ verification: "verified" })
    .where(eq(schema.qualifications.id, row.id));

  await logAccess({
    kind: "verification.approve",
    actor: session.id,
    subject: row.profileId,
    meta: {
      qualificationId: row.id,
      title: row.title,
      note: parsed.data.note ?? null,
    },
  });

  if (row.ownerUserId) {
    await createNotification({
      userId: row.ownerUserId,
      kind: "qualification.verified",
      title: "A qualification was verified",
      body: `${row.title} is now showing the Verified badge on your profile.`,
      link: "/dashboard/qualifications",
      meta: { qualificationId: row.id },
    });
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/dashboard/qualifications");
  return ok();
}

const rejectQualSchema = z.object({
  qualificationId: z.string().min(1),
  reason: z.string().min(10, "Give the seeker a clear reason (10+ chars).").max(280),
});

export async function rejectQualification(
  input: z.infer<typeof rejectQualSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = rejectQualSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Invalid input.");
  }
  const db = getDb();

  const rows = await db
    .select({
      id: schema.qualifications.id,
      profileId: schema.qualifications.profileId,
      title: schema.qualifications.title,
      ownerUserId: schema.profiles.userId,
    })
    .from(schema.qualifications)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.qualifications.profileId),
    )
    .where(eq(schema.qualifications.id, parsed.data.qualificationId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Qualification not found.");

  await db
    .update(schema.qualifications)
    .set({ verification: "rejected" })
    .where(eq(schema.qualifications.id, row.id));

  await logAccess({
    kind: "verification.reject",
    actor: session.id,
    subject: row.profileId,
    meta: {
      qualificationId: row.id,
      title: row.title,
      reason: parsed.data.reason,
    },
  });

  if (row.ownerUserId) {
    await createNotification({
      userId: row.ownerUserId,
      kind: "qualification.rejected",
      title: "A qualification was rejected",
      body: `${row.title} — admin note: ${parsed.data.reason}`,
      link: "/dashboard/qualifications",
      meta: { qualificationId: row.id, reason: parsed.data.reason },
    });
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/dashboard/qualifications");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Organisations
// ─────────────────────────────────────────────────────────────────────────────

const orgVerifySchema = z.object({
  orgId: z.string().min(1),
  note: z.string().max(280).optional(),
});

export async function approveOrganisation(
  input: z.infer<typeof orgVerifySchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = orgVerifySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, parsed.data.orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Organisation not found.");

  await db
    .update(schema.organizations)
    .set({ verification: "verified" })
    .where(eq(schema.organizations.id, row.id));

  await logAccess({
    kind: "org.approve",
    actor: session.id,
    subject: row.id,
    meta: { name: row.name, note: parsed.data.note ?? null },
  });

  await notifyOrgMembers(row.id, {
    kind: "org.verified",
    title: "Your organisation is verified",
    body: `${row.name} is now a verified employer. Search and reveal are unlocked for every member.`,
    link: "/employer",
    meta: { orgId: row.id, orgName: row.name },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/employer/organisation");
  revalidatePath("/employer");
  return ok();
}

const orgRejectSchema = z.object({
  orgId: z.string().min(1),
  reason: z.string().min(10, "Give the org a clear reason (10+ chars).").max(280),
});

export async function rejectOrganisation(
  input: z.infer<typeof orgRejectSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = orgRejectSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Invalid input.");
  }
  const db = getDb();

  const rows = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, parsed.data.orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Organisation not found.");

  await db
    .update(schema.organizations)
    .set({ verification: "rejected" })
    .where(eq(schema.organizations.id, row.id));

  await logAccess({
    kind: "org.reject",
    actor: session.id,
    subject: row.id,
    meta: { name: row.name, reason: parsed.data.reason },
  });

  await notifyOrgMembers(row.id, {
    kind: "org.rejected",
    title: "Organisation verification was rejected",
    body: `${row.name} — admin note: ${parsed.data.reason}`,
    link: "/employer/organisation",
    meta: { orgId: row.id, orgName: row.name, reason: parsed.data.reason },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/employer/organisation");
  return ok();
}
