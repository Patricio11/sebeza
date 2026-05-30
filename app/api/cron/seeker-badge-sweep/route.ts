/**
 * Phase 11.1.4  nightly achievement-badge sweep.
 *
 * Iterates every non-deleted seeker profile and calls
 * `awardEligibleBadges` to insert any newly-earned badges. Idempotent
 * by the UNIQUE constraint on `(profile_id, slug)`  re-runs across
 * cron restarts or manual invocations don't duplicate.
 *
 * No notification fired here  Phase 11.1.4 ships the dashboard
 * surface only. A bell-ping notification can land in a follow-up
 * once the badge UX is bedded in.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isNull } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { awardEligibleBadges } from "@/lib/seeker/badges";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const startedAt = new Date();
  try {
    const db = getDb();
    const profiles = await db
      .select({
        id: schema.profiles.id,
        userId: schema.profiles.userId,
        handle: schema.profiles.handle,
      })
      .from(schema.profiles)
      .where(isNull(schema.profiles.deletedAt));

    let totalAwarded = 0;
    let touched = 0;
    for (const p of profiles) {
      const awarded = await awardEligibleBadges(p);
      if (awarded.length > 0) {
        touched += 1;
        totalAwarded += awarded.length;
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      profilesChecked: profiles.length,
      profilesAwarded: touched,
      badgesAwarded: totalAwarded,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.seeker-badge-sweep] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Sweep failed.",
      },
      { status: 500 },
    );
  }
}
