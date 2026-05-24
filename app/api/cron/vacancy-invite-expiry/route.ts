/**
 * Phase 9.8.4  Nightly invite-expiry sweep.
 *
 * For every `vacancy_invitations` row where:
 *   state = 'invited'
 *   AND expires_at IS NOT NULL
 *   AND expires_at < now()
 *
 * the cron transitions to `state='expired'`, fires two notifications
 * (`vacancy.invite.expired` seeker / `vacancy.invite.unanswered`
 * employer org members), and writes one `vacancy.invite.expire`
 * audit-log row. Idempotent: a row that has already moved past
 * `invited` (e.g. the seeker responded between read and write) is a
 * no-op  the `expireInvitationFromCron` helper performs the flip
 * conditionally.
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}). Fail-
 * closed if the env var is unset. Same pattern as the other six
 * Phase-8 cron routes  see `lib/cron/auth.ts:15`.
 *
 * Channel pipeline: both notifications honour the in-app + email
 * pipeline. Resend stays dormant per Phase 8; in-app always fires.
 * The catalog default for both kinds is `defaultInApp: true,
 * defaultEmail: false` so they don't spam until the email flag flips.
 */

import { NextResponse } from "next/server";
import { and, eq, isNotNull, lt } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { expireInvitationFromCron } from "@/lib/employer/invitations-cron";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();

  try {
    const db = getDb();

    // Pull every expired-but-still-invited row with the context the
    // helper needs for the notifications (vacancy title, org name,
    // seeker user-id + display name, expiry-days for the body line).
    // Single round trip; the cron is small even on a large platform
    // (the volume scales with `invite_expiry_days × open vacancies`).
    const due = await db
      .select({
        invitationId: schema.vacancyInvitations.id,
        vacancyId: schema.vacancyInvitations.vacancyId,
        vacancyTitle: schema.vacancies.title,
        organizationId: schema.vacancies.organizationId,
        orgName: schema.organizations.name,
        inviteExpiryDays: schema.vacancies.inviteExpiryDays,
        seekerUserId: schema.profiles.userId,
        seekerDisplayName: schema.profiles.displayName,
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
          isNotNull(schema.vacancyInvitations.expiresAt),
          lt(schema.vacancyInvitations.expiresAt, ranAt),
        ),
      );

    let fired = 0;
    for (const row of due) {
      try {
        const flipped = await expireInvitationFromCron({
          invitationId: row.invitationId,
          vacancyId: row.vacancyId,
          vacancyTitle: row.vacancyTitle,
          organizationId: row.organizationId,
          orgName: row.orgName,
          seekerUserId: row.seekerUserId,
          seekerDisplayName: row.seekerDisplayName,
          inviteExpiryDays: row.inviteExpiryDays,
        });
        if (flipped) fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[cron.vacancy-invite-expiry] failed for ${row.invitationId}:`,
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
    console.error("[cron.vacancy-invite-expiry] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Cron failed.",
      },
      { status: 500 },
    );
  }
}
