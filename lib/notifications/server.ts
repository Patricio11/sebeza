/**
 * Phase 7 (Task 7.6) — In-app notifications: write-side core.
 *
 * `createNotification` is the canonical entry point for every action
 * that needs to surface a bell-icon notification. It:
 *   1. Looks up the recipient's `notification_prefs` JSONB.
 *   2. Resolves the effective preference (catalog default ⊕ user override).
 *   3. Silently skips if `inApp: false` (the underlying audit-log row
 *      is still written by the calling action — audits are separate
 *      by design).
 *   4. Idempotency dedupes by `(userId, kind, dedupeKey)` inside the
 *      kind's catalog `dedupeWindowSeconds`.
 *   5. Inserts.
 *
 * The fan-out helpers (`notifyOrgMembers`, `notifyAllAdmins`) live here
 * for the multi-recipient cases. Each writes one row per recipient —
 * cheap at our scale and keeps the read query trivially fast.
 *
 * This file is `"server-only"` (helpers, not Server Actions). The
 * mark-read / mark-all-read Server Actions live in `actions.ts`.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  NOTIFICATION_CATALOG,
  type NotificationKind,
  type NotificationPrefMap,
  effectivePref,
} from "./catalog";

export interface CreateNotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  /** Display-only context — never raw PII. */
  meta?: Record<string, unknown>;
  /**
   * Optional dedupe discriminator (e.g. `orgId` so two different orgs
   * viewing the same seeker each get their own notification). When
   * unset, dedupe applies to `(userId, kind)` alone.
   */
  dedupeKey?: string;
}

/**
 * Insert one notification. Honours user preferences + dedupe window.
 * Never throws — a notification-write failure must not break the
 * calling Server Action's main mutation.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    const db = getDb();
    const meta = NOTIFICATION_CATALOG[input.kind];

    // Honour user preferences (catalog default ⊕ user override).
    // Suspended/deleted users still get rows queued so they see them
    // on restore — only `inApp: false` skips.
    const userRows = await db
      .select({
        notificationPrefs: schema.appUser.notificationPrefs,
        deletedAt: schema.appUser.deletedAt,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, input.userId))
      .limit(1);
    const user = userRows[0];
    if (!user) return; // recipient gone — nothing to do
    if (user.deletedAt) return; // erased — never write to a tombstone

    const pref = effectivePref(
      user.notificationPrefs as NotificationPrefMap | null,
      input.kind,
    );
    if (!pref.inApp) return;

    // Dedupe inside the catalog window.
    if (meta.dedupeWindowSeconds > 0) {
      const since = new Date(Date.now() - meta.dedupeWindowSeconds * 1000);
      const existing = await db
        .select({ id: schema.notifications.id, meta: schema.notifications.meta })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, input.userId),
            eq(schema.notifications.kind, input.kind),
            sql`${schema.notifications.createdAt} >= ${since}`,
          ),
        )
        .orderBy(desc(schema.notifications.createdAt))
        .limit(20);

      if (input.dedupeKey) {
        // Per-(kind,dedupeKey) dedupe — e.g. one `profile.viewed` per org per day.
        const hit = existing.find(
          (e) =>
            (e.meta as Record<string, unknown> | null)?.dedupeKey ===
            input.dedupeKey,
        );
        if (hit) return;
      } else if (existing.length > 0) {
        return;
      }
    }

    await db.insert(schema.notifications).values({
      id: `ntf_${randomUUID()}`,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      meta: {
        ...(input.meta ?? {}),
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      },
    });
  } catch (e) {
    // POPIA: a notifications-write failing must NEVER break the request
    // path (audit-log is the system of record). Log and swallow.
    // eslint-disable-next-line no-console
    console.error("[notifications] createNotification failed:", e);
  }
}

/**
 * Fan-out to every member of an organisation. Used for `org.verified`
 * / `org.rejected` / `saved_search.new_matches` etc.
 */
export async function notifyOrgMembers(
  orgId: string,
  payload: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  try {
    const db = getDb();
    const members = await db
      .select({ userId: schema.organizationMembers.userId })
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.organizationId, orgId));
    await Promise.all(
      members.map((m) =>
        createNotification({ ...payload, userId: m.userId }),
      ),
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[notifications] notifyOrgMembers failed:", e);
  }
}

/**
 * Fan-out to every admin. Used for `moderation.reported` /
 * `verification.queued`.
 */
export async function notifyAllAdmins(
  payload: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  try {
    const db = getDb();
    const admins = await db
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(
        and(
          eq(schema.appUser.role, "admin"),
          sql`${schema.appUser.suspendedAt} IS NULL`,
          sql`${schema.appUser.deletedAt} IS NULL`,
        ),
      );
    await Promise.all(
      admins.map((a) =>
        createNotification({ ...payload, userId: a.id }),
      ),
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[notifications] notifyAllAdmins failed:", e);
  }
}
