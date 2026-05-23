"use server";

/**
 * Phase 7 (Task 7.6)  Server Actions for the bell + preferences UI.
 *
 *   - markRead({ id })        flip one row's read_at.
 *   - markAllRead()           flip every unread row for the user.
 *   - updateNotificationPref  toggle inApp / email for one kind.
 *   - getUnreadCountForBell   wrapper around the cached query so the
 *                              client-side bell can re-poll cheaply.
 *
 * Every action calls `verifySession()`. Notifications belong to one
 * user only; cross-user mutations are impossible from this surface.
 */

import { getDb } from "@/db/client";
import { appUser, notifications } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import {
  NOTIFICATION_CATALOG,
  defaultPrefFor,
  type NotificationKind,
  type NotificationPref,
  type NotificationPrefMap,
} from "./catalog";
import { listForUser, type NotificationItem } from "./query";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const VALID_KINDS = Object.keys(NOTIFICATION_CATALOG) as NotificationKind[];

export async function markRead(input: { id: string }): Promise<ActionResult> {
  const session = await verifySession();
  if (!input?.id) return fail("Missing notification id.");
  const db = getDb();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, input.id),
        eq(notifications.userId, session.id),
        isNull(notifications.readAt),
      ),
    );

  // The bell mounts inside DashboardShell across every dashboard
  // surface  revalidate broadly so the unread badge re-renders on
  // the next navigation (no polling needed).
  revalidatePath("/dashboard", "layout");
  revalidatePath("/employer", "layout");
  revalidatePath("/admin", "layout");
  return ok();
}

export async function markAllRead(): Promise<ActionResult> {
  const session = await verifySession();
  const db = getDb();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.id),
        isNull(notifications.readAt),
      ),
    );

  // The bell mounts inside DashboardShell across every dashboard
  // surface  revalidate broadly so the unread badge re-renders on
  // the next navigation (no polling needed).
  revalidatePath("/dashboard", "layout");
  revalidatePath("/employer", "layout");
  revalidatePath("/admin", "layout");
  return ok();
}

const updatePrefSchema = z.object({
  kind: z.string(),
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
});

export async function updateNotificationPref(
  input: z.infer<typeof updatePrefSchema>,
): Promise<ActionResult> {
  const session = await verifySession();
  const parsed = updatePrefSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  if (!VALID_KINDS.includes(parsed.data.kind as NotificationKind)) {
    return fail("Unknown notification kind.");
  }
  const kind = parsed.data.kind as NotificationKind;
  const db = getDb();

  const userRows = await db
    .select({ prefs: appUser.notificationPrefs })
    .from(appUser)
    .where(eq(appUser.id, session.id))
    .limit(1);
  const existing = (userRows[0]?.prefs as NotificationPrefMap | null) ?? {};

  const current: NotificationPref = existing[kind] ?? defaultPrefFor(kind);
  const next: NotificationPref = {
    inApp: parsed.data.inApp ?? current.inApp,
    email: parsed.data.email ?? current.email,
  };

  const merged: NotificationPrefMap = { ...existing, [kind]: next };

  await db
    .update(appUser)
    .set({ notificationPrefs: merged, updatedAt: new Date() })
    .where(eq(appUser.id, session.id));

  revalidatePath("/dashboard/account");
  revalidatePath("/employer/account");
  revalidatePath("/admin/account");
  return ok();
}

/**
 * Cursor-paginated loader for the "Load older" button on
 * /dashboard|employer|admin/notifications. Both arguments are
 * validated inside `listForUser` against the signed-in user.
 */
const loadOlderSchema = z.object({
  before: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function loadOlderNotifications(
  input: z.infer<typeof loadOlderSchema>,
): Promise<ActionResult<{ items: NotificationItem[] }>> {
  await verifySession();
  const parsed = loadOlderSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid cursor.");
  const items = await listForUser({
    before: parsed.data.before,
    limit: parsed.data.limit ?? 20,
  });
  return ok({ items });
}
