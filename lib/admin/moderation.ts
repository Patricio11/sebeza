"use server";

/**
 * Phase 7 — Admin moderation queue actions.
 *
 *   - flagProfile: public (anonymous OR signed-in) Report-this-profile
 *     button from `/p/[handle]`. Writes a `reports` row and audit-logs.
 *   - suspendUser: hard stops sign-in for the target. `app_user.suspended_at`
 *     gets set; sign-in flow bounces with a clear message.
 *   - restoreUser: clears the suspension; user can sign in again.
 *   - closeReport: marks a report closed_no_action OR actioned with a
 *     closing reason.
 *
 * Suspending a user that's an org owner ALSO requires manual handover
 * (Phase 9 launch checklist). We don't auto-promote anyone here.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyAdmin, getSessionUser } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification, notifyAllAdmins } from "@/lib/notifications/server";

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
// flagProfile — called from the public /p/[handle] Report button
// ─────────────────────────────────────────────────────────────────────────────

const flagSchema = z.object({
  handle: z.string().min(1),
  reason: z.enum(["fake_identity", "inappropriate", "harassment", "spam", "other"]),
  note: z.string().max(500).optional(),
});

export async function flagProfile(
  input: z.infer<typeof flagSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = flagSchema.safeParse(input);
  if (!parsed.success) return fail("Please pick a reason and try again.");

  // Optional session — reports can be filed anonymously.
  const session = await getSessionUser();
  const db = getDb();

  const profileRows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, parsed.data.handle))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return fail("Profile not found.");

  const id = `rep_${randomUUID()}`;
  await db.insert(schema.reports).values({
    id,
    subjectProfileId: profile.id,
    reporterUserId: session?.id ?? null,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
    status: "open",
  });

  await logAccess({
    kind: "report.flag",
    actor: session?.id ?? "anonymous",
    subject: profile.id,
    meta: {
      handle: parsed.data.handle,
      reason: parsed.data.reason,
      reportId: id,
    },
  });

  await notifyAllAdmins({
    kind: "moderation.reported",
    title: "A profile was reported",
    body: `@${parsed.data.handle} — reason: ${parsed.data.reason.replace("_", " ")}`,
    link: "/admin/moderation",
    meta: { handle: parsed.data.handle, reason: parsed.data.reason, reportId: id },
  });

  revalidatePath("/admin/moderation");
  return ok({ id });
}

// ─────────────────────────────────────────────────────────────────────────────
// suspendUser / restoreUser
// ─────────────────────────────────────────────────────────────────────────────

const suspendSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(10, "Give a clear suspension reason (10+ chars).").max(280),
});

export async function suspendUser(
  input: z.infer<typeof suspendSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Invalid input.");
  }
  // Admins can't suspend themselves.
  if (parsed.data.userId === session.id) {
    return fail("You can't suspend your own account.");
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      role: schema.appUser.role,
      suspendedAt: schema.appUser.suspendedAt,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, parsed.data.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("User not found.");

  // Admins can't suspend other admins from this surface — that's an
  // org-handover decision documented in the Phase 9 launch checklist.
  if (user.role === "admin") {
    return fail("Suspending another admin requires a manual ops procedure.");
  }
  if (user.suspendedAt) return fail("User is already suspended.");

  await db
    .update(schema.appUser)
    .set({
      suspendedAt: new Date(),
      suspendedReason: parsed.data.reason,
      suspendedByUserId: session.id,
    })
    .where(eq(schema.appUser.id, user.id));

  await logAccess({
    kind: "account.suspend",
    actor: session.id,
    subject: user.id,
    meta: { email: user.email, role: user.role, reason: parsed.data.reason },
  });

  // Queue the notification so the user sees it when (if) restored.
  // The bell can only render once they sign in again — the row sits
  // unread in the meantime, by design.
  await createNotification({
    userId: user.id,
    kind: "account.suspended",
    title: "Your account has been suspended",
    body: parsed.data.reason,
    link: "/dashboard",
    meta: { reason: parsed.data.reason },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/moderation");
  return ok();
}

export async function restoreUser(input: {
  userId: string;
}): Promise<ActionResult> {
  const session = await verifyAdmin();
  if (!input?.userId) return fail("Missing user id.");

  const db = getDb();
  const rows = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      suspendedAt: schema.appUser.suspendedAt,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, input.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("User not found.");
  if (!user.suspendedAt) return fail("User is not suspended.");

  await db
    .update(schema.appUser)
    .set({
      suspendedAt: null,
      suspendedReason: null,
      suspendedByUserId: null,
    })
    .where(eq(schema.appUser.id, user.id));

  await logAccess({
    kind: "account.restore",
    actor: session.id,
    subject: user.id,
    meta: { email: user.email },
  });

  await createNotification({
    userId: user.id,
    kind: "account.restored",
    title: "Your account has been restored",
    body: "You can sign in and use Sebenza again. Welcome back.",
    link: "/dashboard",
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/moderation");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// closeReport
// ─────────────────────────────────────────────────────────────────────────────

const closeReportSchema = z.object({
  reportId: z.string().min(1),
  resolution: z.enum(["closed_no_action", "actioned"]),
  reason: z.string().min(5).max(280),
});

export async function closeReport(
  input: z.infer<typeof closeReportSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = closeReportSchema.safeParse(input);
  if (!parsed.success) return fail("Provide a short resolution note.");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.reports.id,
      subjectProfileId: schema.reports.subjectProfileId,
      status: schema.reports.status,
    })
    .from(schema.reports)
    .where(eq(schema.reports.id, parsed.data.reportId))
    .limit(1);
  const report = rows[0];
  if (!report) return fail("Report not found.");
  if (report.status !== "open") return fail("Report already resolved.");

  await db
    .update(schema.reports)
    .set({
      status: parsed.data.resolution,
      closedAt: new Date(),
      closedByUserId: session.id,
      closedReason: parsed.data.reason,
    })
    .where(eq(schema.reports.id, report.id));

  await logAccess({
    kind: "report.close",
    actor: session.id,
    subject: report.subjectProfileId,
    meta: {
      reportId: report.id,
      resolution: parsed.data.resolution,
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/admin/moderation");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// eraseUser — soft-delete via app_user.deleted_at; Phase 8 cron hard-deletes
// after the 30-day grace period. Lives next to suspend/restore because it
// shares the account-lifecycle category.
// ─────────────────────────────────────────────────────────────────────────────

const eraseSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(10, "Reason must be at least 10 characters.").max(500),
});

export async function eraseUser(
  input: z.infer<typeof eraseSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = eraseSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Invalid input.");
  }
  if (parsed.data.userId === session.id) {
    return fail("You can't erase your own account.");
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      role: schema.appUser.role,
      deletedAt: schema.appUser.deletedAt,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, parsed.data.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("User not found.");
  if (user.role === "admin") {
    return fail("Admin accounts can't be erased from this surface.");
  }
  if (user.deletedAt) return fail("User already erased.");

  await db
    .update(schema.appUser)
    .set({ deletedAt: new Date() })
    .where(eq(schema.appUser.id, user.id));

  await logAccess({
    kind: "account.erase",
    actor: session.id,
    subject: user.id,
    meta: { email: user.email, role: user.role, reason: parsed.data.reason },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/moderation");
  return ok();
}
