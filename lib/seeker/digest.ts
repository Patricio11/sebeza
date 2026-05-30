/**
 * Phase 11.1.1  weekly seeker digest composer.
 *
 * Pure read-side composition over existing queries. No new tables,
 * no new audit kinds beyond `seeker.weekly_digest` itself. The Monday
 * cron at /api/cron/seeker-weekly-digest cursors over opted-in
 * seekers and calls `composeWeeklyDigest(profile)`  the result is
 * handed to `createNotification` which routes it through the existing
 * email transport.
 *
 * Suppression posture (cron-side, not here): we don't email seekers
 * who already received the digest in the past 6 days (catalog dedupe
 * window), nor seekers whose absence + zero deltas would make the
 * email feel like noise. See `app/api/cron/seeker-weekly-digest/
 * route.ts` for the full predicate.
 */

import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { freshnessSummary } from "@/lib/status";
import { rankInPoolQuery } from "@/db/queries/analytics";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DigestProfile {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  profession: string;
  province: string;
  statusConfirmedAt: Date;
}

export interface DigestPayload {
  /** Whole numbers we can plug into copy without further formatting. */
  viewers7d: number;
  contacts7d: number;
  newInvites7d: number;
  /** Current rank in (profession × province) pool; null if unranked. */
  rank: number | null;
  poolTotal: number | null;
  projectedRank: number | null;
  /** Freshness  band + days since last confirm. */
  freshnessBand: "fresh" | "ageing" | "stale";
  daysStale: number;
  /** True when every number above is zero AND status is fresh
   *  silent week from the platform's side; the cron uses this to
   *  decide whether to actually send. */
  isSilentWeek: boolean;
}

export async function composeWeeklyDigest(
  profile: DigestProfile,
): Promise<DigestPayload> {
  const db = getDb();
  const sinceLastWeek = new Date(Date.now() - ONE_WEEK_MS);

  // ── Viewers + contacts: count distinct events in the last 7 days
  // against this profile's handle or id. Same subject-set the
  // activity ledger already uses, kept local here so we don't pull a
  // separate page-shaped helper into the cron path.
  const viewerRows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.kind, "profile.view"),
        sql`${schema.auditLog.subject} IN (${profile.handle}, ${profile.id})`,
        gte(schema.auditLog.at, sinceLastWeek),
      ),
    );
  const viewers7d = viewerRows[0]?.n ?? 0;

  const contactRows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.auditLog)
    .where(
      and(
        sql`${schema.auditLog.kind} IN ('profile.contact.request', 'profile.contact.reveal')`,
        sql`${schema.auditLog.subject} IN (${profile.handle}, ${profile.id})`,
        gte(schema.auditLog.at, sinceLastWeek),
      ),
    );
  const contacts7d = contactRows[0]?.n ?? 0;

  // ── New invites in the last 7 days. `vacancy_invitations.createdAt`
  // is the relevant cursor  invites already-actioned still count
  // as new arrivals for the digest window.
  const inviteRows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.vacancyInvitations)
    .where(
      and(
        eq(schema.vacancyInvitations.profileId, profile.id),
        gte(schema.vacancyInvitations.invitedAt, sinceLastWeek),
      ),
    );
  const newInvites7d = inviteRows[0]?.n ?? 0;

  // ── Rank + projection. Same blend the dashboard rank card uses;
  // pool-total comes back next to it so the digest can phrase
  // "#42 of 213 in your pool".
  const rank = await rankInPoolQuery({
    handle: profile.handle,
    profession: profile.profession,
    province: profile.province,
    projectedSkillBoost: 2,
  });

  const fresh = freshnessSummary(profile.statusConfirmedAt);

  const isSilentWeek =
    viewers7d === 0 &&
    contacts7d === 0 &&
    newInvites7d === 0 &&
    fresh.band === "fresh";

  return {
    viewers7d,
    contacts7d,
    newInvites7d,
    rank: rank?.rank ?? null,
    poolTotal: rank?.poolTotal ?? null,
    projectedRank: rank?.projectedRank ?? null,
    freshnessBand: fresh.band,
    daysStale: fresh.days,
    isSilentWeek,
  };
}
