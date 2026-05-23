/**
 * Phase 7 (Task 7.6)  Read-side: list + unread count.
 *
 * Both queries scope to the signed-in user via `verifySession()`.
 * Cross-user reads are impossible from this surface.
 */

import "server-only";
import { cache } from "react";
import { getDb } from "@/db/client";
import { appUser, notifications } from "@/db/schema";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import type { NotificationKind, NotificationPrefMap } from "./catalog";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface ListOpts {
  /** Default 20, max 100. */
  limit?: number;
  /** Cursor  ISO string. Returns items strictly older than this. */
  before?: string;
}

export async function listForUser(opts: ListOpts = {}): Promise<NotificationItem[]> {
  const session = await verifySession();
  const db = getDb();
  const limit = Math.min(opts.limit ?? 20, 100);

  const conditions = [eq(notifications.userId, session.id)];
  if (opts.before) {
    const cursorDate = new Date(opts.before);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(notifications.createdAt, cursorDate));
    }
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    title: r.title,
    body: r.body,
    link: r.link,
    meta: (r.meta as Record<string, unknown>) ?? null,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Unread count  drives the bell badge. Memoised per render so a
 * layout call + a header call only run once.
 */
export const unreadCount = cache(async (): Promise<number> => {
  const session = await verifySession();
  const db = getDb();
  const rows = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.id),
        isNull(notifications.readAt),
      ),
    );
  return rows[0]?.c ?? 0;
});

/**
 * Reads the signed-in user's stored `notification_prefs` JSONB.
 * Returns `null` when no row has been written yet  the catalog
 * defaults apply.
 */
export async function getMyNotificationPrefs(): Promise<NotificationPrefMap | null> {
  const session = await verifySession();
  const db = getDb();
  const rows = await db
    .select({ prefs: appUser.notificationPrefs })
    .from(appUser)
    .where(eq(appUser.id, session.id))
    .limit(1);
  const prefs = rows[0]?.prefs;
  return (prefs as NotificationPrefMap | null) ?? null;
}
