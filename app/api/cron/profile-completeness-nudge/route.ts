/**
 * The 50% nudge (docs/SEEKER_ONBOARDING_POLISH_PLAN.md, 2026-08-26).
 *
 * The day after someone joins, if their profile is still under half
 * complete, tell them ONCE what is missing: in the bell and by email
 * (they may not have come back yet). Never repeated, never sent at the
 * moment of signup, never to a deleted or suspended account.
 *
 * Idempotency: NOT EXISTS against `notifications` on
 * kind = 'profile.completeness.nudge' for the user (the same once-ever
 * pattern as the interview reminder and the follow-up nudge crons).
 *
 * Auth: `isAuthorizedCron` (Bearer ${CRON_SECRET}), fail-closed.
 */

import { NextResponse } from "next/server";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/server";
import { logAccess } from "@/lib/audit";

const MIN_AGE_HOURS = 24;
const THRESHOLD = 50;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();
  const cutoff = new Date(ranAt.valueOf() - MIN_AGE_HOURS * 60 * 60 * 1000);

  try {
    const db = getDb();
    const due = await db
      .select({
        profileId: schema.profiles.id,
        userId: schema.profiles.userId,
        displayName: schema.profiles.displayName,
        completeness: schema.profiles.completeness,
        city: schema.profiles.city,
        profilePhotoUrl: schema.profiles.profilePhotoUrl,
        bio: schema.profiles.bio,
      })
      .from(schema.profiles)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.profiles.userId))
      .where(
        and(
          isNull(schema.profiles.deletedAt),
          isNull(schema.appUser.suspendedAt),
          isNull(schema.appUser.deletedAt),
          lt(schema.profiles.memberSince, cutoff),
          lt(schema.profiles.completeness, THRESHOLD),
          sql`NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.kind = 'profile.completeness.nudge'
              AND n.user_id = ${schema.profiles.userId}
          )`,
        ),
      );

    let fired = 0;
    for (const row of due) {
      try {
        // Name what is missing, concretely, so the email is a to-do
        // list rather than a guilt trip.
        const missing: string[] = [];
        if (!row.profilePhotoUrl) missing.push("a profile photo");
        if (!row.city || row.city.trim() === "" || row.city === "Pending") {
          missing.push("your city");
        }
        if (!row.bio || row.bio.trim().length < 20) missing.push("a short summary");
        const skillRows = await db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(schema.profileSkills)
          .where(eq(schema.profileSkills.profileId, row.profileId));
        if ((skillRows[0]?.n ?? 0) < 3) missing.push("a few skills");
        const missingLine =
          missing.length > 0
            ? `Still missing: ${missing.join(", ")}.`
            : "A few more details would help.";

        await createNotification({
          userId: row.userId,
          kind: "profile.completeness.nudge",
          title: `Your profile is ${row.completeness}% complete`,
          body: `${missingLine} Employers search complete profiles first, and finishing takes about five minutes. This is the only reminder we will send.`,
          link: `/dashboard/profile`,
          meta: { profileId: row.profileId, completeness: row.completeness, missing },
        });
        await logAccess({
          kind: "profile.completeness.nudge",
          actor: "system",
          subject: row.profileId,
          meta: { completeness: row.completeness, missing },
        });
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[cron.profile-completeness-nudge] failed for ${row.profileId}:`, e);
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
    console.error("[cron.profile-completeness-nudge] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Cron failed." },
      { status: 500 },
    );
  }
}
