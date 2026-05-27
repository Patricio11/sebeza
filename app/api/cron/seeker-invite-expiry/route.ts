/**
 * Phase 9.17  Nightly seeker-invitation expiry sweep.
 *
 * For every `seeker_invitations` row where:
 *   state = 'pending'
 *   AND expires_at < now()
 *
 * the cron transitions to `state='expired'`, stamps `responded_at`,
 * and writes one `org.seeker_invite.expire` audit-log row per
 * invitation. Idempotent: a row that has already moved past `pending`
 * (e.g. the seeker accepted/declined between read and write) is a
 * no-op because the UPDATE includes `state = 'pending'` in the WHERE.
 *
 * No seeker notification on expiry  the recipient was never a
 * Sebenza user and there's nowhere to deliver an in-app row to. The
 * inviter doesn't get a notification either; the row simply moves
 * off the "Pending" section of `/employer/invites`. Quiet by design.
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}). Fail-
 * closed if the env var is unset. Same pattern as the other Phase-8
 * + Phase-9.8 cron routes.
 */

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { logAccess } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();

  try {
    const db = getDb();

    const due = await db
      .select({
        id: schema.seekerInvitations.id,
        organizationId: schema.seekerInvitations.organizationId,
        email: schema.seekerInvitations.email,
      })
      .from(schema.seekerInvitations)
      .where(
        and(
          eq(schema.seekerInvitations.state, "pending"),
          sql`${schema.seekerInvitations.expiresAt} < ${ranAt}`,
        ),
      );

    let expired = 0;
    for (const row of due) {
      const res = await db
        .update(schema.seekerInvitations)
        .set({ state: "expired", respondedAt: ranAt })
        .where(
          and(
            eq(schema.seekerInvitations.id, row.id),
            eq(schema.seekerInvitations.state, "pending"),
          ),
        );
      // drizzle-orm's update returns a result object; we don't need to
      // inspect its rowCount  the conditional WHERE protects against
      // races + we count `due` rows as expired even if a concurrent
      // accept/decline silently won the race (the audit log on that
      // path captures the real outcome).
      expired += 1;

      await logAccess({
        kind: "org.seeker_invite.expire",
        actor: "system",
        subject: row.id,
        meta: {
          email: row.email.toLowerCase(),
          orgId: row.organizationId,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      ranAt: ranAt.toISOString(),
      seen: due.length,
      expired,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
