/**
 * Phase 17 ("Demand Pulse")  weekly seeker demand-spike nudge.
 *
 * Flag-gated by `feature_flag_seeker_demand_pulse` (ships dark). When on, it
 * cursors non-deleted seeker profiles, and for each computes `getDemandPulse`
 * (the biggest positive employer-demand mover this week, province-scoped, over
 * the seeker's profession + top skills). If something is genuinely heating up
 * it fires the in-app `demand.pulse` notification (email default OFF).
 *
 * Suppression: skip if the seeker already got a pulse in the last 6 days (the
 * catalog dedupe window  cron-restart safe). Per-profile failures isolated.
 *
 * Schedule: weekly, e.g. Vercel cron `0 5 * * 1` (Mon 05:00 UTC). Pure
 * read + notification; demand-side, province-level only (no k-anonymity risk).
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { getSetting } from "@/lib/admin/settings";
import { getDemandPulse } from "@/lib/seeker/demand-pulse";
import { createNotification } from "@/lib/notifications/server";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const startedAt = new Date();
  try {
    const enabled = await getSetting<boolean>("feature_flag_seeker_demand_pulse");
    if (!enabled) {
      return NextResponse.json({
        ok: true,
        ranAt: startedAt.toISOString(),
        skipped: "feature-flag-off",
        profilesChecked: 0,
        pulsesSent: 0,
      });
    }

    const db = getDb();
    const profiles = await db
      .select({
        id: schema.profiles.id,
        userId: schema.profiles.userId,
        profession: schema.profiles.profession,
        province: schema.profiles.province,
      })
      .from(schema.profiles)
      .where(isNull(schema.profiles.deletedAt));

    const sixDaysAgo = new Date(Date.now() - SIX_DAYS_MS);
    let sent = 0;
    let quiet = 0;
    let recentlySent = 0;
    let failed = 0;

    for (const p of profiles) {
      try {
        // Dedupe: skip if a pulse already went out inside the window.
        const recent = await db
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, p.userId),
              eq(schema.notifications.kind, "demand.pulse"),
              gte(schema.notifications.createdAt, sixDaysAgo),
            ),
          )
          .limit(1);
        if (recent.length > 0) {
          recentlySent += 1;
          continue;
        }

        const skillRows = await db
          .select({ label: schema.skills.label })
          .from(schema.profileSkills)
          .innerJoin(
            schema.skills,
            eq(schema.skills.slug, schema.profileSkills.skillSlug),
          )
          .where(eq(schema.profileSkills.profileId, p.id))
          .orderBy(desc(schema.profileSkills.proficiency))
          .limit(3);

        const pulse = await getDemandPulse({
          profession: p.profession,
          province: p.province,
          topSkills: skillRows.map((r) => ({ name: r.label })),
        });
        if (!pulse) {
          quiet += 1;
          continue;
        }

        await createNotification({
          userId: p.userId,
          kind: "demand.pulse",
          title: `${pulse.label} is heating up in ${pulse.province}`,
          body: `${pulse.thisWeek} employer search${
            pulse.thisWeek === 1 ? "" : "es"
          } this week${
            pulse.priorWeekly > 0 ? ` (up from ~${pulse.priorWeekly}/week)` : ""
          }. See where you stand in the Career Compass.`,
          link: "/dashboard/grow",
          meta: {
            label: pulse.label,
            kind: pulse.kind,
            thisWeek: pulse.thisWeek,
            priorWeekly: pulse.priorWeekly,
          },
          dedupeKey: "demand-pulse",
        });
        sent += 1;
      } catch (e) {
        failed += 1;
        console.error(`[cron.seeker-demand-pulse] failed for ${p.id}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      profilesChecked: profiles.length,
      pulsesSent: sent,
      quiet,
      recentlySent,
      failed,
    });
  } catch (e) {
    console.error("[cron.seeker-demand-pulse] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Demand-pulse cron failed.",
      },
      { status: 500 },
    );
  }
}
