/**
 * Phase 9.12.6  Daily learning-nudge cron.
 *
 * For every `learning_items` row in state `accepted` OR `in_progress`
 * that has gone silent for >= NUDGE_AFTER_DAYS days AND hasn't been
 * nudged since the last state change, fire one `learning.nudge`
 * notification (gentle: "still working on X?").
 *
 * Idempotency: `learning_items.nudge_last_sent_at` tracks the last fire
 * so a re-run on the same day is a no-op. Mirrors the
 * `profiles.status_stale_last_sent_at` pattern in
 * `cron/status-stale-warning/route.ts`.
 *
 * D5 cross-kind weekly cap: for each candidate recipient we look at the
 * `notifications` table for any `vacancy.outcome.other-hired` OR
 * `learning.nudge` row in the last 7 days. If either exists, we skip
 * this recipient for this run  the cap is channel-agnostic + cross-kind
 * by design. A learner who just heard "you weren't selected" from 9.11
 * should NOT also receive "still working on X?" the same week.
 *
 * `learning.completed` is exempt from the cap (positive payoff is never
 * throttled)  fired from the action site, not here.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, isNull, or, sql, inArray } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/server";
import { SKILLS } from "@/lib/mock/taxonomy";

const NUDGE_AFTER_DAYS = 14;
const D5_CAP_DAYS = 7;
/** Cap how many recipients a single cron run can fire to. Protects the
 *  email rate limit + matches the 9.11 OUTCOME_FANOUT_CAP cadence. */
const MAX_FIRES_PER_RUN = 100;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  try {
    const db = getDb();
    const silentCutoff = new Date(
      Date.now() - NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
    const capCutoff = new Date(
      Date.now() - D5_CAP_DAYS * 24 * 60 * 60 * 1000,
    );

    // Candidates: accepted/in_progress items whose last state change
    // (started_at if in_progress, else created_at) is older than the
    // silent-cutoff, AND we either haven't nudged or the nudge anchor
    // predates the last state change.
    const candidates = await db
      .select({
        id: schema.learningItems.id,
        profileId: schema.learningItems.profileId,
        skillSlug: schema.learningItems.skillSlug,
        state: schema.learningItems.state,
        startedAt: schema.learningItems.startedAt,
        createdAt: schema.learningItems.createdAt,
        nudgeLastSentAt: schema.learningItems.nudgeLastSentAt,
        userId: schema.profiles.userId,
      })
      .from(schema.learningItems)
      .innerJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.learningItems.profileId),
      )
      .where(
        and(
          inArray(schema.learningItems.state, ["accepted", "in_progress"]),
          isNull(schema.profiles.deletedAt),
          sql`COALESCE(${schema.learningItems.startedAt}, ${schema.learningItems.createdAt}) < ${silentCutoff}`,
          or(
            isNull(schema.learningItems.nudgeLastSentAt),
            sql`${schema.learningItems.nudgeLastSentAt} < COALESCE(${schema.learningItems.startedAt}, ${schema.learningItems.createdAt})`,
          ),
        ),
      )
      .limit(MAX_FIRES_PER_RUN);

    const labelBySlug = new Map(SKILLS.map((s) => [s.slug, s.label]));
    const now = new Date();
    let fired = 0;
    let cappedByD5 = 0;

    for (const c of candidates) {
      // D5 check: any vacancy.outcome.other-hired OR learning.nudge in
      // the last 7 days for this user? Skip if so.
      const recent = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, c.userId),
            inArray(schema.notifications.kind, [
              "vacancy.outcome.other-hired",
              "learning.nudge",
            ]),
            sql`${schema.notifications.createdAt} >= ${capCutoff}`,
          ),
        )
        .limit(1);
      if (recent.length > 0) {
        cappedByD5++;
        continue;
      }

      const skillLabel = labelBySlug.get(c.skillSlug) ?? c.skillSlug;
      try {
        await createNotification({
          userId: c.userId,
          kind: "learning.nudge",
          title: `Still working on ${skillLabel}?`,
          body: `A gentle check-in  it's been a while since this learning item moved. If you've stalled for a reason worth recording, tap "Give up" so we can point you somewhere better next time. Otherwise, Mark complete when you're done.`,
          link: "/dashboard/grow",
          meta: {
            itemId: c.id,
            skillSlug: c.skillSlug,
            state: c.state,
          },
        });
        await db
          .update(schema.learningItems)
          .set({ nudgeLastSentAt: now })
          .where(eq(schema.learningItems.id, c.id));
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[cron.learning-nudge] failed for ${c.id}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      silentAfterDays: NUDGE_AFTER_DAYS,
      d5CapDays: D5_CAP_DAYS,
      candidates: candidates.length,
      fired,
      cappedByD5,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.learning-nudge] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Cron failed." },
      { status: 500 },
    );
  }
}
