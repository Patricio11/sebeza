/**
 * Phase 9.20 Tier 2 D2  Nightly placement check-in-due sweep.
 *
 * For every `placements` row where:
 *   current_status = 'active'
 *   AND hired_at < now() - 3 months  (no placement under the first
 *       milestone can possibly be due)
 *   AND the most recent check-in milestone (3 / 6 / 12 months, then
 *       annual) has passed without a confirmation
 *   AND no `placement.status.check_due` notification has been fired
 *       yet for THAT specific (placement, milestone) pair
 *
 * fires one `placement.status.check_due` notification to the org_members
 * of the placement's organisation. Capped at ONE notification per
 * (placement × milestone) ever  re-prompting on the same milestone is
 * noise. The next milestone will fire its own notification when its
 * date passes.
 *
 * Idempotency: `meta.milestoneMonths` is set on every notification +
 * audit row; the cron's NOT EXISTS subquery checks
 * `meta->>'placementId' AND meta->>'milestoneMonths'`. Same pattern as
 * the Phase 9.19 vacancy-follow-up cron.
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}). Fail-
 * closed if the env var is unset.
 */

import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { notifyOrgMembers } from "@/lib/notifications/server";
import { logAccess } from "@/lib/audit";

// Mirrors the cadence in `lib/employer/placement-lifecycle.ts`
// (D2). Keep these two constants in lock-step.
const MILESTONE_MONTHS = [3, 6, 12] as const;
const ANNUAL_AFTER_MONTHS = 12;

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.valueOf());
  out.setMonth(out.getMonth() + months);
  return out;
}

/**
 * Identify the most recent milestone that has passed for this hire
 * date, expressed as months-since-hire. Returns null if no milestone
 * has passed yet (placement is younger than the first milestone).
 */
function currentMilestoneMonths(
  hiredAt: Date,
  now: Date,
): number | null {
  const monthsSinceHire =
    (now.getTime() - hiredAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsSinceHire < MILESTONE_MONTHS[0]) return null;
  // Walk the fixed series first.
  let latest: number = MILESTONE_MONTHS[0];
  for (const m of MILESTONE_MONTHS) {
    if (addMonths(hiredAt, m).getTime() <= now.getTime()) latest = m;
  }
  // Then annual marks above 12 months. We don't need to walk every
  // annual mark  the latest is `12 + N * ANNUAL_AFTER_MONTHS` where
  // N = floor((monthsSinceHire - 12) / ANNUAL_AFTER_MONTHS).
  if (monthsSinceHire >= 12 + ANNUAL_AFTER_MONTHS) {
    const annualCount = Math.floor(
      (monthsSinceHire - 12) / ANNUAL_AFTER_MONTHS,
    );
    const annualMark = 12 + annualCount * ANNUAL_AFTER_MONTHS;
    if (annualMark > latest) latest = annualMark;
  }
  return latest;
}

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();
  const earliestPossibleHire = addMonths(ranAt, -MILESTONE_MONTHS[0]);

  try {
    const db = getDb();

    // Pull every active placement old enough to possibly be due. We
    // additionally pre-filter on `last_check_at < earliestPossibleHire`
    // OR NULL  a placement checked more recently than the first
    // milestone can't be due. The JS post-filter narrows the rest.
    const candidates = await db
      .select({
        placementId: schema.placements.id,
        profileId: schema.placements.profileId,
        organizationId: schema.placements.organizationId,
        hiredAt: schema.placements.hiredAt,
        lastCheckAt: schema.placements.lastCheckAt,
        role: schema.placements.role,
        seekerDisplayName: schema.profiles.displayName,
      })
      .from(schema.placements)
      .innerJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.placements.profileId),
      )
      .where(
        and(
          eq(schema.placements.currentStatus, "active"),
          lt(schema.placements.hiredAt, earliestPossibleHire),
        ),
      );

    let fired = 0;
    let alreadyNotified = 0;
    for (const row of candidates) {
      const hiredAt =
        row.hiredAt instanceof Date ? row.hiredAt : new Date(row.hiredAt);
      const lastCheckAt =
        row.lastCheckAt === null
          ? null
          : row.lastCheckAt instanceof Date
            ? row.lastCheckAt
            : new Date(row.lastCheckAt);
      const milestoneMonths = currentMilestoneMonths(hiredAt, ranAt);
      if (milestoneMonths === null) continue;
      const milestoneDate = addMonths(hiredAt, milestoneMonths);
      const checkSatisfies =
        lastCheckAt !== null &&
        lastCheckAt.getTime() >= milestoneDate.getTime();
      if (checkSatisfies) continue;

      // Dedupe: a notification for this (placement, milestone) already
      // exists? Single SQL existence check per due placement; the cron
      // runs nightly so this is bounded.
      const alreadyRows = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.kind, "placement.status.check_due"),
            sql`${schema.notifications.meta}->>'placementId' = ${row.placementId}`,
            sql`${schema.notifications.meta}->>'milestoneMonths' = ${String(milestoneMonths)}`,
          ),
        )
        .limit(1);
      if (alreadyRows.length > 0) {
        alreadyNotified++;
        continue;
      }

      // Fire fan-out + audit. notifyOrgMembers handles writing one row
      // per org member; the audit row is a single batch line so the
      // export sweep can see the "we asked" event without N audit rows.
      const milestoneLabel = formatMilestone(milestoneMonths);
      try {
        await notifyOrgMembers(row.organizationId, {
          kind: "placement.status.check_due",
          title: `${row.seekerDisplayName}  status check due (${milestoneLabel})`,
          body:
            `${row.seekerDisplayName} hit the ${milestoneLabel} mark in their ${row.role} role. ` +
            `Tap to confirm they're still in the seat  one question, one tap, keeps the platform's retention figure honest.`,
          link: `/employer/placements/${row.placementId}`,
          meta: {
            placementId: row.placementId,
            orgId: row.organizationId,
            milestoneMonths: String(milestoneMonths),
          },
        });
        await logAccess({
          kind: "placement.status.check_due",
          actor: "system",
          subject: row.profileId,
          meta: {
            orgId: row.organizationId,
            placementId: row.placementId,
            milestoneMonths,
            milestoneDate: milestoneDate.toISOString(),
          },
        });
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[cron.placement-status-check-due] failed for ${row.placementId}:`,
          e,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: ranAt.toISOString(),
      candidates: candidates.length,
      fired,
      alreadyNotified,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.placement-status-check-due] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Cron failed.",
      },
      { status: 500 },
    );
  }
}

function formatMilestone(months: number): string {
  if (months < 12) return `${months}-month`;
  if (months === 12) return "12-month";
  const years = months / 12;
  if (Number.isInteger(years)) return `${years}-year`;
  return `${months}-month`;
}
