/**
 * The day-after "finish your profile" nudge
 * (docs/SEEKER_ONBOARDING_POLISH_PLAN.md, 2026-08-26).
 *
 * A day after someone joins, if their profile is still under half
 * complete OR missing the main information employers read first (a
 * short summary, at least three skills, a city), tell them ONCE what
 * is missing: in the bell and by email (they may not have come back
 * yet). Never repeated, never sent at the moment of signup, never to a
 * deleted or suspended account.
 *
 * Idempotency: `profiles.profile_complete_notified_at` (migration
 * 0077). The marker lives on the profile, so clearing the bell can
 * never earn a second nudge, and admins can see who was told.
 *
 * Auth: `isAuthorizedCron` (Bearer ${CRON_SECRET}), fail-closed.
 */

import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/server";
import { logAccess } from "@/lib/audit";

const MIN_AGE_HOURS = 24;
const THRESHOLD = 50;
const MIN_SUMMARY_CHARS = 20;
const MIN_SKILLS = 3;

/** Stable keys; the email template turns them into a checklist. */
type MissingKey = "photo" | "city" | "summary" | "skills";

const MISSING_LABELS: Record<MissingKey, string> = {
  photo: "a profile photo",
  city: "your city",
  summary: "a short summary about you",
  skills: "a few more skills",
};

const skillCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM profile_skills ps WHERE ps.profile_id = ${schema.profiles.id}
)`;
const cityMissingSql = sql`(${schema.profiles.city} IS NULL OR btrim(${schema.profiles.city}) = '' OR ${schema.profiles.city} = 'Pending')`;
const summaryMissingSql = sql`(${schema.profiles.bio} IS NULL OR length(btrim(${schema.profiles.bio})) < ${MIN_SUMMARY_CHARS})`;

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
        completeness: schema.profiles.completeness,
        city: schema.profiles.city,
        profilePhotoUrl: schema.profiles.profilePhotoUrl,
        bio: schema.profiles.bio,
        skillCount: skillCountSql,
      })
      .from(schema.profiles)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.profiles.userId))
      .where(
        and(
          isNull(schema.profiles.deletedAt),
          isNull(schema.appUser.suspendedAt),
          isNull(schema.appUser.deletedAt),
          isNull(schema.profiles.profileCompleteNotifiedAt),
          lt(schema.profiles.memberSince, cutoff),
          or(
            lt(schema.profiles.completeness, THRESHOLD),
            summaryMissingSql,
            cityMissingSql,
            sql`${skillCountSql} < ${MIN_SKILLS}`,
          ),
        ),
      );

    let fired = 0;
    for (const row of due) {
      try {
        // Name what is missing, concretely, so the message is a to-do
        // list rather than a guilt trip.
        const missing: MissingKey[] = [];
        if (!row.profilePhotoUrl) missing.push("photo");
        if (!row.city || row.city.trim() === "" || row.city === "Pending") missing.push("city");
        if (!row.bio || row.bio.trim().length < MIN_SUMMARY_CHARS) missing.push("summary");
        if (Number(row.skillCount) < MIN_SKILLS) missing.push("skills");
        const missingLine =
          missing.length > 0
            ? `Still missing: ${missing.map((k) => MISSING_LABELS[k]).join(", ")}.`
            : "A few more details would help.";

        // Mark FIRST: if the send throws after the mark we lose one
        // nudge; the other order risks sending twice. Once-ever wins.
        const marked = await db
          .update(schema.profiles)
          .set({ profileCompleteNotifiedAt: ranAt })
          .where(
            and(
              eq(schema.profiles.id, row.profileId),
              isNull(schema.profiles.profileCompleteNotifiedAt),
            ),
          )
          .returning({ id: schema.profiles.id });
        if (marked.length === 0) continue;

        await createNotification({
          userId: row.userId,
          kind: "profile.completeness.nudge",
          title: "Finish your Sebenza profile",
          body: `Your profile is ${row.completeness}% complete. ${missingLine} Employers read complete profiles first, and finishing takes about five minutes. This is the only reminder we will send.`,
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
