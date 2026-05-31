/**
 * Phase 11.4.2  nightly followed-employer vacancy sweep.
 *
 * For every `vacancies` row that was newly created in the last 24h
 * (status='open'), find all `seeker_followed_employers` rows
 * matching the org_id, intersect with seekers whose (profession,
 * province) match the vacancy, and fire one
 * `employer.opened_vacancy.in_your_pool` notification per match.
 *
 * Idempotency: the notification catalog's 24h dedupe window on
 * `employer.opened_vacancy.in_your_pool` (per user × kind) prevents
 * duplicate sends if the cron runs more than once per day.
 *
 * No PII leaves the seeker's record  the notification body says
 * the employer name + the role + a deep-link. The seeker's
 * follow-list membership is private to them.
 */

import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/server";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const startedAt = new Date();
  try {
    const db = getDb();
    const since = new Date(Date.now() - ONE_DAY_MS);

    // Fresh open vacancies from the last 24h.
    const fresh = await db
      .select({
        id: schema.vacancies.id,
        orgId: schema.vacancies.organizationId,
        title: schema.vacancies.title,
        professionSlug: schema.vacancies.professionSlug,
        provinceSlug: schema.vacancies.provinceSlug,
        orgName: schema.organizations.name,
      })
      .from(schema.vacancies)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.vacancies.organizationId),
      )
      .where(
        and(
          eq(schema.vacancies.status, "open"),
          gte(schema.vacancies.createdAt, since),
        ),
      );

    let totalFired = 0;
    let totalMatches = 0;

    for (const v of fresh) {
      // Find followers of this org whose (profession, province) matches.
      // Province + profession are stored as labels on profiles; slug
      // comparison happens at the seeker-profile JOIN via lower-case.
      const followers = await db
        .select({
          userId: schema.profiles.userId,
          profession: schema.profiles.profession,
          province: schema.profiles.province,
        })
        .from(schema.seekerFollowedEmployers)
        .innerJoin(
          schema.profiles,
          eq(schema.profiles.id, schema.seekerFollowedEmployers.profileId),
        )
        .where(
          and(
            eq(schema.seekerFollowedEmployers.orgId, v.orgId),
            sql`${schema.profiles.deletedAt} IS NULL`,
            sql`LOWER(${schema.profiles.profession}) = LOWER(REPLACE(${v.professionSlug}, '-', ' '))`,
            sql`LOWER(${schema.profiles.province}) = LOWER(REPLACE(${v.provinceSlug}, '-', ' '))`,
          ),
        );

      totalMatches += followers.length;

      for (const f of followers) {
        try {
          await createNotification({
            userId: f.userId,
            kind: "employer.opened_vacancy.in_your_pool",
            title: `${v.orgName} opened a role in your pool`,
            body: `${v.title}  ${f.profession} · ${f.province}. You're following ${v.orgName}; this is the quiet ping you asked for.`,
            link: `/search?q=${encodeURIComponent(v.orgName)}&province=${encodeURIComponent(v.provinceSlug)}`,
            // Per-org dedupe inside the catalog's 24h window so an
            // employer publishing a burst of vacancies doesn't flood
            // the same seeker multiple times in a day.
            dedupeKey: `org:${v.orgId}`,
            meta: {
              orgId: v.orgId,
              vacancyId: v.id,
              vacancyTitle: v.title,
            },
          });
          totalFired += 1;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(
            `[cron.followed-employer-vacancy-sweep] failed for vacancy=${v.id} user=${f.userId}:`,
            e,
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      vacanciesChecked: fresh.length,
      matchedFollowers: totalMatches,
      notificationsFired: totalFired,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.followed-employer-vacancy-sweep] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Cron failed.",
      },
      { status: 500 },
    );
  }
}
