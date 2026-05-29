/**
 * Phase 9.19 D8  Nightly follow-up nudge sweep.
 *
 * For every `vacancy_invitations` row where:
 *   state = 'invited'
 *   AND invited_at < now() - 7 days
 *   AND the parent vacancy has follow_up_nudges_enabled = true
 *   AND no `vacancy.invite.followup` notification has been sent yet
 *
 * fires a single in-app notification to the seeker reminding them
 * that the invitation is still open. Capped at ONE nudge per invite
 * ever  re-nudging is harassment.
 *
 * Idempotency is enforced by checking the `notifications` table for
 * a prior `vacancy.invite.followup` whose `meta->>'invitationId'`
 * matches; a row that already has one is silently skipped. The
 * `vacancies.follow_up_nudges_enabled` flag is the employer's
 * opt-in (default false per D8).
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}). Fail-
 * closed if the env var is unset. Same pattern as the other Phase 8
 * cron routes.
 *
 * No expiry interaction  the parallel `vacancy-invite-expiry` cron
 * still flips invitations whose `expires_at < now()` to `expired`
 * independently. An invite can be nudged once at day 7 and still be
 * expired later if it goes past the configured window without a
 * response; the two surfaces are orthogonal.
 */

import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/server";
import { logAccess } from "@/lib/audit";

const NUDGE_AFTER_DAYS = 7;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();
  const sevenDaysAgo = new Date(
    ranAt.valueOf() - NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const db = getDb();

    // Candidate invites: still in `invited` state, older than 7 days,
    // belonging to a vacancy with the opt-in flag on. We use a NOT
    // EXISTS subquery against `notifications` to skip invites that
    // already received a follow-up  same effect as a dedupeKey, but
    // explicit (and the dedupe window we want is "ever," not a
    // catalog-configured number of seconds).
    const due = await db
      .select({
        invitationId: schema.vacancyInvitations.id,
        vacancyId: schema.vacancyInvitations.vacancyId,
        vacancyTitle: schema.vacancies.title,
        organizationId: schema.vacancies.organizationId,
        orgName: schema.organizations.name,
        seekerUserId: schema.profiles.userId,
        seekerDisplayName: schema.profiles.displayName,
        invitedAt: schema.vacancyInvitations.invitedAt,
        expiresAt: schema.vacancyInvitations.expiresAt,
      })
      .from(schema.vacancyInvitations)
      .innerJoin(
        schema.vacancies,
        eq(schema.vacancies.id, schema.vacancyInvitations.vacancyId),
      )
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.vacancies.organizationId),
      )
      .innerJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.vacancyInvitations.profileId),
      )
      .where(
        and(
          eq(schema.vacancyInvitations.state, "invited"),
          lt(schema.vacancyInvitations.invitedAt, sevenDaysAgo),
          eq(schema.vacancies.followUpNudgesEnabled, true),
          sql`NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.kind = 'vacancy.invite.followup'
              AND (n.meta->>'invitationId') = ${schema.vacancyInvitations.id}
          )`,
        ),
      );

    let fired = 0;
    for (const row of due) {
      try {
        const expirySuffix = row.expiresAt
          ? ` It expires on ${row.expiresAt.toISOString().slice(0, 10)} if there's no response.`
          : "";
        await createNotification({
          userId: row.seekerUserId,
          kind: "vacancy.invite.followup",
          title: `Still open: ${row.orgName} invited you to ${row.vacancyTitle}`,
          body:
            `A week has passed and your invitation is still waiting. ` +
            `Open it to accept, decline, or decline with a reason  ` +
            `declining is free and never affects your visibility in search.${expirySuffix}`,
          link: `/dashboard/invitations/${row.invitationId}`,
          meta: {
            invitationId: row.invitationId,
            vacancyId: row.vacancyId,
            orgId: row.organizationId,
            orgName: row.orgName,
            // Surfaced for the seeker's own activity panel: the
            // employer explicitly opted into nudges, this isn't a
            // platform-imposed reminder.
            followUpReason: "employer_opt_in",
          },
        });
        await logAccess({
          kind: "vacancy.invite.followup",
          actor: "system",
          subject: row.invitationId,
          meta: {
            orgId: row.organizationId,
            vacancyId: row.vacancyId,
            seekerUserId: row.seekerUserId,
            invitedAt: row.invitedAt.toISOString(),
          },
        });
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[cron.vacancy-follow-up-nudges] failed for ${row.invitationId}:`,
          e,
        );
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
    console.error("[cron.vacancy-follow-up-nudges] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Cron failed.",
      },
      { status: 500 },
    );
  }
}
