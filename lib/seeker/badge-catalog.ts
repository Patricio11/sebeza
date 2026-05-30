/**
 * Phase 11.1.4  canonical catalog of seeker achievement badges.
 *
 * Six badges  enough variety to feel real, few enough that each one
 * has to be earned. All derive from audit-log data we already have;
 * no new event source.
 *
 * Schema posture: storing the slug as `text` in the DB keeps adding a
 * new badge a code-only change. This catalog is the source of truth
 * for labels + descriptions + the eligibility predicate.
 */

export const BADGE_SLUGS = [
  "profile_verified",
  "first_invite_accepted",
  "ten_invites_accepted",
  "five_view_week",
  "status_streak_90",
  "first_placement",
] as const;

export type BadgeSlug = (typeof BADGE_SLUGS)[number];

export interface BadgeMeta {
  slug: BadgeSlug;
  /** Two-word display title rendered on the medallion. */
  title: string;
  /** One-line description shown on hover / tap. */
  description: string;
  /** Path to the static SVG medallion in /public/badges. */
  artwork: string;
}

export const BADGE_CATALOG: Record<BadgeSlug, BadgeMeta> = {
  profile_verified: {
    slug: "profile_verified",
    title: "Verified profile",
    description:
      "Awarded the first time a qualification or KYC document on your profile is admin-verified.",
    artwork: "/badges/profile-verified.svg",
  },
  first_invite_accepted: {
    slug: "first_invite_accepted",
    title: "First yes",
    description:
      "Awarded the first time you accepted a vacancy invitation. The first conversation on Sebenza.",
    artwork: "/badges/first-invite-accepted.svg",
  },
  ten_invites_accepted: {
    slug: "ten_invites_accepted",
    title: "Ten conversations",
    description:
      "Awarded after ten vacancy invitations accepted across your time on the platform.",
    artwork: "/badges/ten-invites-accepted.svg",
  },
  five_view_week: {
    slug: "five_view_week",
    title: "Active week",
    description:
      "Awarded when five distinct employer organisations viewed your dossier inside a 7-day window.",
    artwork: "/badges/five-view-week.svg",
  },
  status_streak_90: {
    slug: "status_streak_90",
    title: "Fresh streak",
    description:
      "Awarded when your work status has been confirmed three monthly cycles in a row.",
    artwork: "/badges/status-streak-90.svg",
  },
  first_placement: {
    slug: "first_placement",
    title: "First placement",
    description:
      "Awarded when an employer confirms a placement of you on Sebenza  the Placement-Truth event.",
    artwork: "/badges/first-placement.svg",
  },
};

export function isBadgeSlug(value: string): value is BadgeSlug {
  return (BADGE_SLUGS as readonly string[]).includes(value);
}
