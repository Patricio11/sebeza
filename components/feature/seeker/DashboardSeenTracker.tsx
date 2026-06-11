"use client";

/**
 * Invisible client island that refreshes the welcome-back cookie
 * AFTER the dashboard renders. Pairing half of the read/write split
 * in lib/cookies/welcome-back.ts  the Server Component reads the
 * PREVIOUS visit's timestamp during render; this island writes the
 * new one via a Server Action once mounted, so the next visit has
 * its reference point without the render ever calling
 * `cookies().set()` (which Next.js forbids in RSC and which crashed
 * the page  see docs/completed/DASHBOARD_COOKIE_CRASH_FIX_PLAN.md).
 *
 * Degradation: with JS disabled the cookie never refreshes, so the
 * welcome-back card never fires for those browsers. Acceptable  the
 * card is a nicety; the dashboard itself stays fully server-rendered.
 */

import { useEffect } from "react";
import { recordDashboardSeen } from "@/lib/cookies/welcome-back-actions";

export function DashboardSeenTracker() {
  useEffect(() => {
    // Fire-and-forget; an overwrite race with a second tab is
    // harmless (both write "now").
    void recordDashboardSeen().catch(() => {
      // Swallow  a failed cookie refresh must never surface to the
      // seeker; worst case the welcome-back card misfires next visit.
    });
  }, []);
  return null;
}
