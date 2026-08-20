/**
 * Phase 35  Web Push: the send side.
 *
 * `server-only` helper, deliberately NOT a Server Action module: a
 * `"use server"` export is a public endpoint, and nothing outside the
 * server should be able to ask us to push anything to anyone.
 *
 * VAPID keys resolve through the Integrations Hub (`push` channel),
 * the same Save → Test → Enable seam the storage and messaging
 * credentials use, so the founder can rotate them without a redeploy.
 * There is no env fallback: push is admin-configured or it is off.
 *
 * Failure posture matches the rest of the notification stack: a push
 * that cannot be delivered must never break the action that triggered
 * it. Everything here swallows its errors and reports counts.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { resolveIntegration } from "@/lib/integrations/resolve";
import {
  PUSH_DEFAULT_SUBJECT,
  PUSH_FAILURE_THRESHOLD,
  type PushPayload,
} from "./config";

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * The live VAPID config, or null when push is not configured/enabled.
 * Never throws: an undecryptable row degrades to "push is off" rather
 * than taking down whatever action was trying to notify someone.
 */
export async function resolveVapid(): Promise<VapidConfig | null> {
  const admin = await resolveIntegration("push");
  if (!admin) return null;
  const publicKey = admin.secrets.publicKey?.trim();
  const privateKey = admin.secrets.privateKey?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: admin.config.subject?.trim() || PUSH_DEFAULT_SUBJECT,
  };
}

/** The public key the browser needs to subscribe. Safe to hand to a
 *  client: it is public by design. Null when push is off. */
export async function publicVapidKey(): Promise<string | null> {
  return (await resolveVapid())?.publicKey ?? null;
}

export interface PushSendResult {
  delivered: number;
  /** Subscriptions deleted because the push service said they are gone
   *  (404/410) or they crossed the consecutive-failure threshold. */
  pruned: number;
  /** No subscriptions, or push not configured. */
  skipped: boolean;
}

/**
 * Deliver one payload to every device a user has opted in on.
 *
 * Sends are issued in parallel because a slow vendor endpoint must not
 * hold up the others, and the whole call is best-effort.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const empty: PushSendResult = { delivered: 0, pruned: 0, skipped: true };
  try {
    const vapid = await resolveVapid();
    if (!vapid) return empty;

    const db = getDb();
    const subs = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    if (subs.length === 0) return empty;

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const body = JSON.stringify(payload);

    const outcomes = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            { TTL: 60 * 60 * 24 },
          );
          return { id: sub.id, ok: true, gone: false };
        } catch (e) {
          // 404 / 410 mean the subscription is permanently gone: the
          // browser profile was wiped or the user revoked permission.
          // Anything else (timeout, 5xx) is transient and only counts
          // toward the threshold.
          const status = (e as { statusCode?: number }).statusCode;
          return {
            id: sub.id,
            ok: false,
            gone: status === 404 || status === 410,
          };
        }
      }),
    );

    const delivered = outcomes.filter((o) => o.ok).map((o) => o.id);
    const gone = outcomes.filter((o) => o.gone).map((o) => o.id);
    const failed = outcomes
      .filter((o) => !o.ok && !o.gone)
      .map((o) => o.id);

    if (delivered.length) {
      await db
        .update(schema.pushSubscriptions)
        .set({ lastSuccessAt: new Date(), failureCount: 0 })
        .where(inArray(schema.pushSubscriptions.id, delivered));
    }
    if (failed.length) {
      await db
        .update(schema.pushSubscriptions)
        .set({ failureCount: sql`${schema.pushSubscriptions.failureCount} + 1` })
        .where(inArray(schema.pushSubscriptions.id, failed));
    }

    // Prune the permanently-gone plus anything that has failed
    // consecutively past the threshold.
    const stale = await db
      .select({ id: schema.pushSubscriptions.id })
      .from(schema.pushSubscriptions)
      .where(
        sql`${schema.pushSubscriptions.userId} = ${userId} AND ${schema.pushSubscriptions.failureCount} >= ${PUSH_FAILURE_THRESHOLD}`,
      );
    const toDelete = Array.from(
      new Set([...gone, ...stale.map((s) => s.id)]),
    );
    if (toDelete.length) {
      await db
        .delete(schema.pushSubscriptions)
        .where(inArray(schema.pushSubscriptions.id, toDelete));
    }

    return {
      delivered: delivered.length,
      pruned: toDelete.length,
      skipped: false,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[push] dispatch failed:", e);
    return empty;
  }
}

/**
 * Store (or refresh) one browser's subscription. Keyed on the endpoint,
 * which IS the subscription's identity: the same browser re-subscribing
 * must update its row, never fork a duplicate that delivers twice.
 *
 * If the endpoint already belongs to a DIFFERENT user (a shared phone,
 * or a device handed on), it is re-pointed at the current user. The
 * alternative, two rows on one endpoint, would push one person's
 * notifications to the other's device.
 */
export async function saveSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel: string | null;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({
      id: `push_${randomUUID()}`,
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      deviceLabel: input.deviceLabel,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        deviceLabel: input.deviceLabel,
        failureCount: 0,
      },
    });
}

/** Forget one browser's subscription. */
export async function deleteSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.pushSubscriptions)
    .where(
      sql`${schema.pushSubscriptions.userId} = ${userId} AND ${schema.pushSubscriptions.endpoint} = ${endpoint}`,
    );
}

/** Forget every device for a user. Used by the prefs panel's "turn off
 *  everywhere" and by account erasure paths that want it explicit
 *  rather than relying on the FK cascade. */
export async function deleteAllSubscriptions(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))
    .returning({ id: schema.pushSubscriptions.id });
  return rows.length;
}

/** How many devices a user currently has opted in. */
export async function subscriptionCount(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));
  return rows.length;
}
