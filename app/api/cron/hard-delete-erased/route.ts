/**
 * Phase 8  Nightly hard-delete cron.
 *
 * Selects every `app_user` row with `deleted_at < now() - interval '30 days'`
 * (soft-deleted via Phase 7 admin "Erase") and DELETEs the user. Cascades
 * remove the profile, experiences, qualifications, placements (cascade
 * isn't set on placements  we handle it manually), consents,
 * notifications, sessions, accounts, verification, two_factor.
 *
 * One `account.hard_delete` audit row per user, written BEFORE the
 * DELETE so we have legal proof of erasure if anyone asks. The
 * notifications row for the user is wiped along with everything else.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { logAccess } from "@/lib/audit";

const GRACE_DAYS = 30;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  // Pull the cohort of users past their grace window. Audit before delete.
  const due = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      role: schema.appUser.role,
      deletedAt: schema.appUser.deletedAt,
    })
    .from(schema.appUser)
    .where(
      and(
        isNotNull(schema.appUser.deletedAt),
        lt(schema.appUser.deletedAt, cutoff),
      ),
    );

  let processed = 0;
  for (const user of due) {
    try {
      // Audit FIRST  system-of-record proof of erasure.
      await logAccess({
        kind: "account.hard_delete",
        actor: "system",
        subject: user.id,
        meta: {
          email: user.email,
          role: user.role,
          softDeletedAt: user.deletedAt?.toISOString() ?? null,
          graceDays: GRACE_DAYS,
        },
      });

      // placements has no ON DELETE CASCADE  drop the user's rows manually.
      // The FK is profileId, so we resolve through profiles.
      await db.execute(sql`
        DELETE FROM placements
        WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = ${user.id})
      `);

      // Everything else cascades.
      await db.delete(schema.appUser).where(eq(schema.appUser.id, user.id));
      processed++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[cron.hard-delete-erased] failed for ${user.id}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    candidates: due.length,
    processed,
  });
}
