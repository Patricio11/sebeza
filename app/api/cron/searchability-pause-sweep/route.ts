/**
 * Phase 11.3.1  nightly searchability-pause auto-unpause sweep.
 *
 * Finds every consents row where `paused_until <= now()` and clears
 * the three pause columns + writes `consent.searchability.pause_expired`
 * audit rows. Idempotent at the WHERE-clause layer  re-runs across
 * cron restarts or manual invocations don't double-fire.
 *
 * No notification ships here  the seeker re-enters the recruiter
 * funnel quietly. Surfacing the auto-unpause in the bell would be
 * noise; the privacy page shows the active state on next visit.
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

  const startedAt = new Date();
  try {
    const db = getDb();
    const due = await db
      .select({
        id: schema.consents.id,
        userId: schema.consents.userId,
        pausedUntil: schema.consents.pausedUntil,
      })
      .from(schema.consents)
      .where(
        and(
          eq(schema.consents.purpose, "searchability"),
          sql`${schema.consents.pausedUntil} IS NOT NULL`,
          sql`${schema.consents.pausedUntil} <= now()`,
        ),
      );

    let cleared = 0;
    for (const row of due) {
      try {
        await db
          .update(schema.consents)
          .set({
            pausedAt: null,
            pausedUntil: null,
            pausedReason: null,
          })
          .where(eq(schema.consents.id, row.id));

        await logAccess({
          kind: "consent.searchability.pause_expired",
          actor: "system",
          subject: row.id,
          meta: {
            userId: row.userId,
            originalPausedUntil: row.pausedUntil?.toISOString() ?? null,
          },
        });
        cleared += 1;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[cron.searchability-pause-sweep] failed for ${row.id}:`,
          e,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      pausesChecked: due.length,
      pausesCleared: cleared,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.searchability-pause-sweep] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Pause sweep failed.",
      },
      { status: 500 },
    );
  }
}
