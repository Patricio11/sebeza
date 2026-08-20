"use server";

/**
 * Phase 35  Web Push: the three Server Actions the browser calls.
 *
 * Every export here is a PUBLIC endpoint, so each one re-derives the
 * session itself and only ever touches the caller's own rows. Nothing
 * takes a userId from the client.
 *
 * Constants and payload shaping live in `./config`, and the sender in
 * `./send`, because a `"use server"` module may only export async
 * functions.
 */

import { headers } from "next/headers";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { deviceLabelFrom } from "./config";
import {
  deleteAllSubscriptions,
  deleteSubscription,
  publicVapidKey,
  saveSubscription,
  subscriptionCount,
} from "./send";

export interface PushStatus {
  /** Push is configured by an admin AND the platform flag is on. */
  available: boolean;
  /** The browser needs this to call `pushManager.subscribe`. */
  publicKey: string | null;
  /** How many devices this user has already opted in. */
  devices: number;
}

/**
 * What the opt-in island needs to decide what to render. Safe for any
 * signed-in user; returns the "off" shape for everyone else rather than
 * throwing, so a logged-out render simply shows nothing.
 */
export async function getPushStatus(): Promise<PushStatus> {
  const off: PushStatus = { available: false, publicKey: null, devices: 0 };
  try {
    const user = await getSessionUser();
    if (!user) return off;
    if (!(await getSetting<boolean>("feature_flag_web_push"))) return off;
    const key = await publicVapidKey();
    if (!key) return off;
    return {
      available: true,
      publicKey: key,
      devices: await subscriptionCount(user.id),
    };
  } catch {
    return off;
  }
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(300),
  auth: z.string().min(1).max(300),
});

/**
 * Register this browser for push. Idempotent: the same browser calling
 * twice updates one row.
 */
export async function subscribeToPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!(await getSetting<boolean>("feature_flag_web_push"))) {
    return { ok: false, error: "Push notifications are not available yet." };
  }
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That subscription could not be read." };
  }
  const ua = (await headers()).get("user-agent");
  await saveSubscription({
    userId: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.p256dh,
    auth: parsed.data.auth,
    deviceLabel: deviceLabelFrom(ua),
  });
  return { ok: true };
}

/**
 * Forget this browser (or, with no endpoint, every device). Never
 * gated on the feature flag: turning something off must keep working
 * even after the switch that turned it on is flipped back.
 */
export async function unsubscribeFromPush(
  endpoint?: string,
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (endpoint) {
    await deleteSubscription(user.id, endpoint);
    return { ok: true, removed: 1 };
  }
  return { ok: true, removed: await deleteAllSubscriptions(user.id) };
}
