/**
 * Phase 11.1.3  cookie helper for the welcome-back delta card.
 *
 * No new DB column for "last seen the dashboard"  a cookie is
 * sufficient + survives the typical seeker-browser pattern (long-
 * lived per-device session). Absence >= 7 days triggers the
 * welcome-back card.
 *
 * READ/WRITE SPLIT (post-Phase-13 fix  see
 * docs/completed/DASHBOARD_COOKIE_CRASH_FIX_PLAN.md): Next.js
 * forbids `cookies().set()` during a Server Component render
 * ("Cookies can only be modified in a Server Action or Route
 * Handler")  the original read-then-set helper crashed every
 * /dashboard load with the production error boundary. The READ
 * stays here (legal in RSC); the WRITE lives in
 * `welcome-back-actions.ts → recordDashboardSeen()` and is fired
 * post-render by the `<DashboardSeenTracker>` client island, so the
 * render still sees the PREVIOUS visit's timestamp and the NEXT
 * visit gets its reference point.
 *
 * Privacy posture: the cookie carries a single ISO timestamp,
 * nothing identifying. No tracking pixel; no PII; no audit row.
 */

import { cookies } from "next/headers";

export const WELCOME_BACK_COOKIE = "sebenza_dash_last_seen";
export const WELCOME_BACK_MAX_AGE_DAYS = 180; // half-year persistence
const ABSENCE_THRESHOLD_DAYS = 7;

/**
 * Read-only: compute the days the seeker was absent from the
 * previous "last seen" timestamp. Returns `null` when:
 *   - no previous cookie (first visit, or cookie expired)
 *   - absence < ABSENCE_THRESHOLD_DAYS (don't show the card on a
 *     same-session refresh or daily-driver pattern)
 *
 * Does NOT write  the refresh happens via `recordDashboardSeen()`
 * (Server Action) after the page mounts.
 */
export async function readLastSeen(): Promise<number | null> {
  const jar = await cookies();
  const prevValue = jar.get(WELCOME_BACK_COOKIE)?.value;
  if (!prevValue) return null;
  const prev = new Date(prevValue);
  if (Number.isNaN(prev.getTime())) return null;
  const ms = Date.now() - prev.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < ABSENCE_THRESHOLD_DAYS) return null;
  return days;
}
