/**
 * Phase 8 — Daily status-stale nudge.
 *
 * For every seeker whose `status_confirmed_at` is older than the current
 * `freshness_band_days_ageing` setting AND who hasn't already received
 * a stale warning in the current ageing window, fire one
 * `status.stale.warning` notification.
 *
 * Idempotency: `profiles.status_stale_last_sent_at` tracks the last
 * fire so a re-run on the same day is a no-op. We re-fire only after
 * the user re-confirms their status (which clears the anchor) AND it
 * goes stale again.
 *
 * Honours the user's `notification_prefs[status.stale.warning]` via
 * the createNotification gate (catalog default = on).
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/server";
import { getSetting } from "@/lib/admin/settings";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  try {
    const ageingDays = await getSetting<number>("freshness_band_days_ageing");
    const ageingCutoff = new Date(
      Date.now() - ageingDays * 24 * 60 * 60 * 1000,
    );
    // Only re-fire if the previous nudge was sent BEFORE the current
    // status was re-confirmed. Phrased as "send when no anchor OR anchor
    // is older than the most-recent statusConfirmedAt".
    const db = getDb();
    const dueProfiles = await db
      .select({
        id: schema.profiles.id,
        userId: schema.profiles.userId,
        handle: schema.profiles.handle,
        statusConfirmedAt: schema.profiles.statusConfirmedAt,
      })
      .from(schema.profiles)
      .where(
        and(
          isNull(schema.profiles.deletedAt),
          sql`${schema.profiles.statusConfirmedAt} < ${ageingCutoff}`,
          or(
            isNull(schema.profiles.statusStaleLastSentAt),
            sql`${schema.profiles.statusStaleLastSentAt} < ${schema.profiles.statusConfirmedAt}`,
          ),
        ),
      );

    const now = new Date();
    let fired = 0;
    for (const p of dueProfiles) {
      const daysStale = Math.floor(
        (Date.now() - p.statusConfirmedAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      try {
        await createNotification({
          userId: p.userId,
          kind: "status.stale.warning",
          title: "Your employment status is going stale",
          body: `It's been ${daysStale} days since you confirmed your status. Re-confirm to keep your profile fresh in search.`,
          link: "/dashboard",
          meta: {
            daysStale,
            ageingThresholdDays: ageingDays,
          },
        });
        await db
          .update(schema.profiles)
          .set({ statusStaleLastSentAt: now })
          .where(eq(schema.profiles.id, p.id));
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[cron.status-stale-warning] failed for ${p.id}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      ageingThresholdDays: ageingDays,
      candidates: dueProfiles.length,
      fired,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.status-stale-warning] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Cron failed." },
      { status: 500 },
    );
  }
}
