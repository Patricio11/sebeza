"use server";

/**
 * Phase 11.4.2  follow-employer Server Actions.
 *
 * D3 invariant: the follow is PRIVATE to the seeker. The employer
 * is never notified, never shown a follower count, never given a
 * follower list. Same privacy posture as the 11.3.2 block list.
 *
 * The followed-employer cron at /api/cron/followed-employer-vacancy-
 * sweep intersects this table with new vacancies in the seeker's
 * (profession, province) pool + fires
 * `employer.opened_vacancy.in_your_pool` notifications. That's the
 * only side-effect the employer can ever indirectly observe (the
 * seeker may show up on the next invite list when they search).
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

async function getMyProfileId(userId: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return row[0]?.id ?? null;
}

export async function followEmployer(
  orgId: string,
): Promise<ActionResult<{ followId: string }>> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) {
    return { ok: false, message: "Finish setting up your profile first." };
  }

  const db = getDb();
  const existing = await db
    .select({ id: schema.seekerFollowedEmployers.id })
    .from(schema.seekerFollowedEmployers)
    .where(
      and(
        eq(schema.seekerFollowedEmployers.profileId, profileId),
        eq(schema.seekerFollowedEmployers.orgId, orgId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, followId: existing[0].id };
  }

  const id = `flw_${randomUUID()}`;
  await db.insert(schema.seekerFollowedEmployers).values({
    id,
    profileId,
    orgId,
  });

  await logAccess({
    kind: "seeker.follow.added",
    actor: me.id,
    subject: profileId,
    meta: { followId: id, orgId },
  });

  revalidatePath("/dashboard/following");
  revalidatePath("/search");
  return { ok: true, followId: id };
}

export async function unfollowEmployer(
  orgId: string,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const db = getDb();
  const existing = await db
    .select({ id: schema.seekerFollowedEmployers.id })
    .from(schema.seekerFollowedEmployers)
    .where(
      and(
        eq(schema.seekerFollowedEmployers.profileId, profileId),
        eq(schema.seekerFollowedEmployers.orgId, orgId),
      ),
    )
    .limit(1);
  if (!existing[0]) return { ok: true };

  await db
    .delete(schema.seekerFollowedEmployers)
    .where(eq(schema.seekerFollowedEmployers.id, existing[0].id));

  await logAccess({
    kind: "seeker.follow.removed",
    actor: me.id,
    subject: profileId,
    meta: { followId: existing[0].id, orgId },
  });

  revalidatePath("/dashboard/following");
  revalidatePath("/search");
  return { ok: true };
}

export interface FollowedEmployer {
  followId: string;
  orgId: string;
  orgName: string;
  orgVerification: "unverified" | "pending" | "verified" | "rejected";
  followedAt: string;
  /** Vacancies the org has open right now in any pool  shown on
   *  the /dashboard/following listing for awareness. */
  openVacancyCount: number;
}

export async function listMyFollows(): Promise<FollowedEmployer[]> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return [];

  const db = getDb();
  const rows = await db
    .select({
      followId: schema.seekerFollowedEmployers.id,
      orgId: schema.seekerFollowedEmployers.orgId,
      followedAt: schema.seekerFollowedEmployers.followedAt,
      orgName: schema.organizations.name,
      orgVerification: schema.organizations.verification,
    })
    .from(schema.seekerFollowedEmployers)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.seekerFollowedEmployers.orgId),
    )
    .where(eq(schema.seekerFollowedEmployers.profileId, profileId))
    .orderBy(desc(schema.seekerFollowedEmployers.followedAt));

  // Per-row open vacancy count. Cheap N+1; the follow list is capped
  // by intent (most seekers follow < 20 orgs) so the round-trip cost
  // is negligible.
  const out: FollowedEmployer[] = [];
  for (const r of rows) {
    const counts = await db
      .select({ count: schema.vacancies.id })
      .from(schema.vacancies)
      .where(
        and(
          eq(schema.vacancies.organizationId, r.orgId),
          eq(schema.vacancies.status, "open"),
        ),
      );
    out.push({
      followId: r.followId,
      orgId: r.orgId,
      orgName: r.orgName,
      orgVerification:
        r.orgVerification as FollowedEmployer["orgVerification"],
      followedAt: r.followedAt.toISOString(),
      openVacancyCount: counts.length,
    });
  }
  return out;
}

/**
 * Read-side helper: do I (this seeker) follow this org? Used to
 * render the heart-icon initial state on /search + /p/{org} cards.
 */
export async function isFollowingEmployer(orgId: string): Promise<boolean> {
  const me = await verifyRole("seeker").catch(() => null);
  if (!me) return false;
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return false;
  const db = getDb();
  const row = await db
    .select({ id: schema.seekerFollowedEmployers.id })
    .from(schema.seekerFollowedEmployers)
    .where(
      and(
        eq(schema.seekerFollowedEmployers.profileId, profileId),
        eq(schema.seekerFollowedEmployers.orgId, orgId),
      ),
    )
    .limit(1);
  return row.length > 0;
}
