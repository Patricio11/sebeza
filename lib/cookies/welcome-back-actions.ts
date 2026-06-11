"use server";

/**
 * Write side of the welcome-back cookie (see welcome-back.ts for the
 * read side + the read/write-split rationale). Lives in its own
 * `"use server"` module because `cookies().set()` is only legal in a
 * Server Action or Route Handler  calling it during the /dashboard
 * Server Component render crashed the page (the production
 * "Something went wrong" boundary, digest 4042959981).
 *
 * Fired by `<DashboardSeenTracker>` on mount. Idempotent  an
 * overwrite with `now()` is the intended behaviour, so locale-switch
 * remounts and double-fires are harmless. No auth gate: the cookie
 * is per-browser, carries a bare timestamp, and writing it for an
 * unauthenticated caller is inert (the dashboard render that READS
 * it sits behind the seeker role guard).
 */

import { cookies } from "next/headers";
import {
  WELCOME_BACK_COOKIE,
  WELCOME_BACK_MAX_AGE_DAYS,
} from "@/lib/cookies/welcome-back";

export async function recordDashboardSeen(): Promise<void> {
  const jar = await cookies();
  jar.set(WELCOME_BACK_COOKIE, new Date().toISOString(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WELCOME_BACK_MAX_AGE_DAYS * 24 * 60 * 60,
  });
}
