/**
 * Phase 11.1.3  cookie helper for the welcome-back delta card.
 *
 * No new DB column for "last seen the dashboard"  a cookie is
 * sufficient + survives the typical seeker-browser pattern (long-
 * lived per-device session). The cookie is rewritten on every
 * dashboard load so the next session knows when the previous one
 * happened; absence >= 7 days triggers the welcome-back card.
 *
 * Privacy posture: the cookie carries a single ISO timestamp,
 * nothing identifying. No tracking pixel; no PII; no audit row
 * the cookie is read-then-set on the same render.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "sebenza_dash_last_seen";
const ABSENCE_THRESHOLD_DAYS = 7;
const COOKIE_MAX_AGE_DAYS = 180; // half-year persistence

/**
 * Read the previous "last seen" timestamp + immediately overwrite it
 * with `now()`. Returns the number of whole days the seeker was
 * absent (rounded down) or `null` when:
 *   - no previous cookie (first visit, or cookie expired)
 *   - absence < ABSENCE_THRESHOLD_DAYS (don't show the card on a
 *     same-session refresh or daily-driver pattern)
 *
 * The cookie write happens regardless of the return value so the
 * "next" sign-in always has a reference point.
 */
export async function readAndSetLastSeen(): Promise<number | null> {
  const jar = await cookies();
  const prevValue = jar.get(COOKIE_NAME)?.value;
  const now = new Date();
  jar.set(COOKIE_NAME, now.toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
  });
  if (!prevValue) return null;
  const prev = new Date(prevValue);
  if (Number.isNaN(prev.getTime())) return null;
  const ms = now.getTime() - prev.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < ABSENCE_THRESHOLD_DAYS) return null;
  return days;
}
