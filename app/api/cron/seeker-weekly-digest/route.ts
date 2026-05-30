/**
 * Phase 11.1.1  Monday weekly seeker digest.
 *
 * Scheduled via Vercel cron `0 4 * * 1` (Monday 04:00 UTC = 06:00 SAST).
 * Cursors over non-deleted seeker profiles, composes a digest payload
 * for each, and dispatches via the existing `createNotification`
 * pathway  the notification catalog routes `seeker.weekly_digest`
 * straight to email (`defaultInApp: false`, `defaultEmail: true`).
 *
 * Suppression rules (cron-local; cheap to evaluate before composing):
 *   1. Skip if the seeker has no email column on app_user (orphaned
 *      profile).
 *   2. Skip if the platform-wide `feature_flag_email_notifications`
 *      killswitch is off  the createNotification gate would skip
 *      anyway but checking up front avoids the per-profile cost.
 *   3. Skip if the seeker received a digest in the last 6 days
 *      (matches the catalog dedupe window  cron-restart safety).
 *   4. Skip "silent weeks": no viewers + no contacts + no new invites
 *      + fresh status. Sending these would feel like noise.
 *
 * Per-profile failures are isolated  one bad row never tanks the run.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, gte, isNull } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { getSetting } from "@/lib/admin/settings";
import { composeWeeklyDigest } from "@/lib/seeker/digest";
import { createNotification } from "@/lib/notifications/server";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const startedAt = new Date();
  try {
    const emailKillswitch = await getSetting<boolean>(
      "feature_flag_email_notifications",
    );
    if (!emailKillswitch) {
      return NextResponse.json({
        ok: true,
        ranAt: startedAt.toISOString(),
        skipped: "email-killswitch-off",
        profilesChecked: 0,
        digestsSent: 0,
      });
    }

    const db = getDb();
    const profiles = await db
      .select({
        id: schema.profiles.id,
        userId: schema.profiles.userId,
        handle: schema.profiles.handle,
        displayName: schema.profiles.displayName,
        profession: schema.profiles.profession,
        province: schema.profiles.province,
        statusConfirmedAt: schema.profiles.statusConfirmedAt,
      })
      .from(schema.profiles)
      .where(isNull(schema.profiles.deletedAt));

    const sixDaysAgo = new Date(Date.now() - SIX_DAYS_MS);
    let sent = 0;
    let silent = 0;
    let recentlySent = 0;
    let failed = 0;

    for (const p of profiles) {
      try {
        // Skip if this user got a digest inside the dedupe window.
        const recent = await db
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, p.userId),
              eq(schema.notifications.kind, "seeker.weekly_digest"),
              gte(schema.notifications.createdAt, sixDaysAgo),
            ),
          )
          .limit(1);
        if (recent.length > 0) {
          recentlySent += 1;
          continue;
        }

        const payload = await composeWeeklyDigest(p);
        if (payload.isSilentWeek) {
          silent += 1;
          continue;
        }

        const title = "Your week on Sebenza";
        const body = digestBodyLine(payload);
        await createNotification({
          userId: p.userId,
          kind: "seeker.weekly_digest",
          title,
          body,
          link: "/dashboard",
          meta: {
            viewers7d: payload.viewers7d,
            contacts7d: payload.contacts7d,
            newInvites7d: payload.newInvites7d,
            rank: payload.rank,
            poolTotal: payload.poolTotal,
            projectedRank: payload.projectedRank,
            freshnessBand: payload.freshnessBand,
            daysStale: payload.daysStale,
          },
        });
        sent += 1;
      } catch (e) {
        failed += 1;
        // eslint-disable-next-line no-console
        console.error(`[cron.seeker-weekly-digest] failed for ${p.id}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      profilesChecked: profiles.length,
      digestsSent: sent,
      silentWeeks: silent,
      recentlySent,
      failed,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.seeker-weekly-digest] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Digest cron failed.",
      },
      { status: 500 },
    );
  }
}

interface DigestBodyInputs {
  viewers7d: number;
  contacts7d: number;
  newInvites7d: number;
  rank: number | null;
  poolTotal: number | null;
  freshnessBand: string;
}

function digestBodyLine(p: DigestBodyInputs): string {
  const parts: string[] = [];
  if (p.viewers7d > 0) {
    parts.push(
      `${p.viewers7d} employer${p.viewers7d === 1 ? "" : "s"} viewed your profile`,
    );
  }
  if (p.contacts7d > 0) {
    parts.push(
      `${p.contacts7d} new contact${p.contacts7d === 1 ? "" : "s"}`,
    );
  }
  if (p.newInvites7d > 0) {
    parts.push(
      `${p.newInvites7d} vacancy invite${p.newInvites7d === 1 ? "" : "s"}`,
    );
  }
  if (p.rank != null && p.poolTotal != null) {
    parts.push(`Rank #${p.rank} of ${p.poolTotal} in your pool`);
  }
  if (parts.length === 0) {
    return "A quiet week  but your status is current and you're still in the pool.";
  }
  return parts.join(" · ") + ".";
}
