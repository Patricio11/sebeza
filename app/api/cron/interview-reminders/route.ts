/**
 * Interview reminders, three days out (docs/INTERVIEWS_PLAN.md).
 *
 * For every interview still `scheduled` or `confirmed` whose start
 * time is 2 to 3 days away, remind BOTH sides once: the seeker gets
 * the full details again (same card email as the original, add-to-
 * calendar included), the org members get a heads-up on their agenda.
 * A calendar helps only people who use calendars; the reminder is the
 * platform doing the remembering.
 *
 * Window logic: the daily run catches each interview exactly once as
 * it crosses the 3-day line. Interviews scheduled closer in than that
 * never get one - the schedule notification IS their reminder.
 *
 * Idempotency: NOT EXISTS against `notifications` on
 * `kind = 'interview.reminder'` + `meta->>'interviewId'` (the same
 * "once, ever" pattern as vacancy-follow-up-nudges).
 *
 * Auth: `isAuthorizedCron` (Bearer ${CRON_SECRET}), fail-closed.
 */

import { NextResponse } from "next/server";
import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification, notifyOrgMembers } from "@/lib/notifications/server";
import { formatSaDateTime } from "@/lib/interviews/links";
import { logAccess } from "@/lib/audit";

const REMIND_BEFORE_DAYS = 3;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();
  const windowEnd = new Date(
    ranAt.valueOf() + REMIND_BEFORE_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const db = getDb();
    const due = await db
      .select({
        id: schema.interviews.id,
        invitationId: schema.interviews.invitationId,
        vacancyId: schema.interviews.vacancyId,
        organizationId: schema.interviews.organizationId,
        startsAt: schema.interviews.startsAt,
        durationMinutes: schema.interviews.durationMinutes,
        locationKind: schema.interviews.locationKind,
        location: schema.interviews.location,
        instructions: schema.interviews.instructions,
        state: schema.interviews.state,
        seekerUserId: schema.profiles.userId,
        seekerDisplayName: schema.profiles.displayName,
        vacancyTitle: schema.vacancies.title,
        orgName: schema.organizations.name,
      })
      .from(schema.interviews)
      .innerJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.interviews.profileId),
      )
      .innerJoin(
        schema.vacancies,
        eq(schema.vacancies.id, schema.interviews.vacancyId),
      )
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.interviews.organizationId),
      )
      .where(
        and(
          inArray(schema.interviews.state, ["scheduled", "confirmed"]),
          gt(schema.interviews.startsAt, ranAt),
          lte(schema.interviews.startsAt, windowEnd),
          sql`NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.kind = 'interview.reminder'
              AND (n.meta->>'interviewId') = ${schema.interviews.id}
          )`,
        ),
      );

    let fired = 0;
    for (const row of due) {
      try {
        const when = formatSaDateTime(row.startsAt);
        // The same meta shape scheduleInterview writes, so the
        // details-card email template renders for the reminder too.
        const detailsMeta = {
          interviewId: row.id,
          invitationId: row.invitationId,
          vacancyId: row.vacancyId,
          startsAtIso: row.startsAt.toISOString(),
          durationMinutes: row.durationMinutes,
          locationKind: row.locationKind,
          location: row.location,
          instructions: row.instructions,
          orgName: row.orgName,
          vacancyTitle: row.vacancyTitle,
          notePii: true,
        };
        await createNotification({
          userId: row.seekerUserId,
          kind: "interview.reminder",
          title: `Interview in ${REMIND_BEFORE_DAYS} days: ${row.vacancyTitle} at ${row.orgName}`,
          body: `${when} (SA time) · ${row.location}${row.state === "scheduled" ? " · You haven't confirmed yet - one tap tells them you're coming." : ""}`,
          link: `/dashboard/invitations/${row.invitationId}`,
          meta: detailsMeta,
        });
        await notifyOrgMembers(row.organizationId, {
          kind: "interview.reminder.employer",
          title: `Interview in ${REMIND_BEFORE_DAYS} days: ${row.seekerDisplayName} for "${row.vacancyTitle}"`,
          body: `${when} (SA time) · ${row.location}${row.state === "scheduled" ? ` · ${row.seekerDisplayName} hasn't confirmed yet.` : ""}`,
          link: `/employer/interviews`,
          meta: detailsMeta,
        });
        await logAccess({
          kind: "interview.reminder",
          actor: "system",
          subject: row.id,
          meta: {
            orgId: row.organizationId,
            vacancyId: row.vacancyId,
            startsAtIso: row.startsAt.toISOString(),
          },
        });
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[cron.interview-reminders] failed for ${row.id}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: ranAt.toISOString(),
      candidates: due.length,
      fired,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.interview-reminders] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Cron failed." },
      { status: 500 },
    );
  }
}
