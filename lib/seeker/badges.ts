/**
 * Phase 11.1.4  badge-awarding logic.
 *
 * Six honest milestones, derived from existing audit-log + profile
 * data. `awardEligibleBadges(profileId)` is idempotent  the UNIQUE
 * constraint on `(profile_id, slug)` makes re-runs safe. The cron at
 * /api/cron/seeker-badge-sweep calls this for every active profile
 * nightly.
 *
 * No new notification kind shipped in 11.1.4 itself  the eventual
 * "achievement.awarded" notification can land in a follow-up when
 * the in-app surface needs the bell ping. For Phase 11.1.4 the badge
 * row + the dashboard strip is the surface.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { logAccess } from "@/lib/audit";
import { BADGE_SLUGS, type BadgeSlug } from "./badge-catalog";

const FIVE_VIEW_WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FIVE_VIEW_WEEK_THRESHOLD = 5;
const STREAK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const STREAK_CONFIRMS_REQUIRED = 3;

interface ProfileForEligibility {
  id: string;
  userId: string;
  handle: string;
}

/**
 * Compute which badges the seeker has now earned that they don't
 * already hold + insert the new rows. Returns the list of slugs
 * awarded this run (empty when nothing new). Auxiliary  failure
 * logs but never tanks the calling cron.
 */
export async function awardEligibleBadges(
  profile: ProfileForEligibility,
): Promise<BadgeSlug[]> {
  const db = getDb();
  const existing = await db
    .select({ slug: schema.seekerBadges.slug })
    .from(schema.seekerBadges)
    .where(eq(schema.seekerBadges.profileId, profile.id));
  const held = new Set<string>(existing.map((r) => r.slug));

  const eligible: BadgeSlug[] = [];

  // 01  profile_verified. Triggered by either an admin-approved
  // qualification (verification.approve) or a KYC approval
  // (kyc.review.approve / kyc.verify). The KYC events carry the
  // profileId as subject; the qualification verification carries the
  // qualification id  for KYC-only we'd miss the qualification path,
  // so we OR both kinds against the profile-id subject. Conservative:
  // when in doubt, don't award.
  if (!held.has("profile_verified")) {
    const verifiedRow = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.subject, profile.id),
          sql`${schema.auditLog.kind} IN ('kyc.review.approve', 'kyc.verify', 'verification.approve')`,
        ),
      )
      .limit(1);
    if (verifiedRow.length > 0) eligible.push("profile_verified");
  }

  // 02 + 03  invitation acceptances. We count distinct accepted
  // invitations from the vacancy_invitations table itself rather
  // than the audit log so a missing audit row doesn't suppress a
  // legitimate milestone.
  const acceptedCount = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.vacancyInvitations)
    .where(
      and(
        eq(schema.vacancyInvitations.profileId, profile.id),
        sql`${schema.vacancyInvitations.state} IN ('accepted', 'accepted_with_notice')`,
      ),
    );
  const n = acceptedCount[0]?.n ?? 0;
  if (n >= 1 && !held.has("first_invite_accepted")) {
    eligible.push("first_invite_accepted");
  }
  if (n >= 10 && !held.has("ten_invites_accepted")) {
    eligible.push("ten_invites_accepted");
  }

  // 04  five_view_week. Count distinct viewing-org subjects in the
  // last 7d. profile.view audit rows carry the org id in meta;
  // counting distinct actors approximates this without parsing
  // jsonb. The audit row's actor for profile.view is the viewing
  // user; for org-level deduping we'd need meta.org_id. Conservative
  // simplification: count distinct actors per window.
  if (!held.has("five_view_week")) {
    const since = new Date(Date.now() - FIVE_VIEW_WEEK_WINDOW_MS);
    const distinctActors = await db
      .select({
        n: sql<number>`COUNT(DISTINCT ${schema.auditLog.actor})::int`,
      })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.kind, "profile.view"),
          eq(schema.auditLog.subject, profile.handle),
          gte(schema.auditLog.at, since),
        ),
      );
    const distinct = distinctActors[0]?.n ?? 0;
    if (distinct >= FIVE_VIEW_WEEK_THRESHOLD) eligible.push("five_view_week");
  }

  // 05  status_streak_90. Need three monthly status-confirm rows in
  // the last 90 days. Both `profile.status.update` and `profile.
  // status.reconfirm` count  the seeker is signaling freshness in
  // either case.
  if (!held.has("status_streak_90")) {
    const since = new Date(Date.now() - STREAK_WINDOW_MS);
    const confirmCount = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(schema.auditLog)
      .where(
        and(
          sql`${schema.auditLog.kind} IN ('profile.status.update', 'profile.status.reconfirm')`,
          eq(schema.auditLog.actor, profile.userId),
          gte(schema.auditLog.at, since),
        ),
      );
    const c = confirmCount[0]?.n ?? 0;
    if (c >= STREAK_CONFIRMS_REQUIRED) eligible.push("status_streak_90");
  }

  // 06  first_placement. Any confirmed (employer-side) placement
  // under this profile id. Seeker self-reports do NOT count  per
  // the Placement-Truth rule a hire is only counted when confirmed
  // via the platform.
  if (!held.has("first_placement")) {
    const placement = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.kind, "placement.confirm"),
          eq(schema.auditLog.subject, profile.id),
        ),
      )
      .limit(1);
    if (placement.length > 0) eligible.push("first_placement");
  }

  if (eligible.length === 0) return [];

  // Insert all new rows in a single statement; ON CONFLICT silently
  // ignores the row when another job has raced this one (the unique
  // constraint guards the integrity).
  const rows = eligible.map((slug) => ({
    id: `bdg_${randomUUID()}`,
    profileId: profile.id,
    slug,
  }));
  try {
    await db
      .insert(schema.seekerBadges)
      .values(rows)
      .onConflictDoNothing();
    for (const r of rows) {
      await logAccess({
        kind: "achievement.awarded",
        actor: profile.userId,
        subject: profile.handle,
        meta: { slug: r.slug, badgeId: r.id },
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[badges] award failed:", e);
  }
  return eligible;
}

export interface RecentBadge {
  slug: BadgeSlug;
  awardedAt: string;
}

/**
 * Read the seeker's most recent badges (newest first, default cap 3
 * for the dashboard strip). Returns canonical badge slugs only
 * unknown slugs (rare; possible if catalog is trimmed) are filtered
 * out client-side.
 */
export async function listMyBadges(
  profileId: string,
  limit = 3,
): Promise<RecentBadge[]> {
  const db = getDb();
  const rows = await db
    .select({
      slug: schema.seekerBadges.slug,
      awardedAt: schema.seekerBadges.awardedAt,
    })
    .from(schema.seekerBadges)
    .where(eq(schema.seekerBadges.profileId, profileId))
    .orderBy(sql`${schema.seekerBadges.awardedAt} DESC`)
    .limit(limit);
  return rows
    .filter((r): r is { slug: BadgeSlug; awardedAt: Date } =>
      (BADGE_SLUGS as readonly string[]).includes(r.slug),
    )
    .map((r) => ({
      slug: r.slug,
      awardedAt: r.awardedAt.toISOString(),
    }));
}
