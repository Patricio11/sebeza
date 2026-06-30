/**
 * Phase 18.2 ("Living Learning Catalog")  weekly freshness heartbeat.
 *
 * Counts live learning paths overdue for re-verification (no `last_verified_at`
 * in over 90 days) and, when any exist, nudges every admin once via the
 * `admin.learning_path.stale` notification so the catalog can't silently rot.
 *
 * Schedule: weekly, e.g. `0 6 * * 1` (Mon 06:00 UTC). Read-only + one
 * notification fan-out; CRON_SECRET-guarded. 6-day catalog dedupe makes a
 * cron restart safe.
 */

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { countStaleLearningPaths } from "@/db/queries/learning-paths";
import { notifyAllAdmins } from "@/lib/notifications/server";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const startedAt = new Date();
  try {
    const stale = await countStaleLearningPaths();
    if (stale > 0) {
      await notifyAllAdmins({
        kind: "admin.learning_path.stale",
        title: `${stale} learning path${stale === 1 ? "" : "s"} need re-verification`,
        body: `${stale} learning path${
          stale === 1 ? " hasn't" : "s haven't"
        } been re-verified in over 90 days. Open Learning paths to review them.`,
        link: "/admin/learning-paths",
        meta: { staleCount: stale },
        dedupeKey: "learning-path-stale",
      });
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      staleCount: stale,
      notified: stale > 0,
    });
  } catch (e) {
    console.error("[cron.learning-path-freshness] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Freshness cron failed.",
      },
      { status: 500 },
    );
  }
}
