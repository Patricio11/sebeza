/**
 * Phase 7 (Task 7.6)  Notification kinds catalog.
 *
 * Single source of truth for: the in-app default, the email default
 * (currently always off; Phase 8 wires Resend and flips these),
 * the audience tag, and the human-readable label for the preferences
 * panel.
 *
 * Adding a new kind:
 *   1. Add an entry here.
 *   2. Add the `createNotification({ kind: '…' })` call where the
 *      action runs.
 *   3. If it's a new audit-log shape too, extend `AuditKind` in
 *      `lib/audit/index.ts`.
 *
 * NEVER reference a kind in code without an entry here  the type
 * checker enforces this via `NotificationKind`.
 */

export type NotificationAudience =
  | "seeker"          // affected seeker only
  | "self"            // the signed-in user, role-agnostic (suspend/restore)
  | "org_members"     // every member of the org
  | "all_admins";     // every admin (broadcast)

export interface NotificationKindMeta {
  /** Default for `notification_prefs[kind].inApp` when unset. */
  defaultInApp: boolean;
  /** Default for `notification_prefs[kind].email` when unset. */
  defaultEmail: boolean;
  /** Who receives this kind. */
  audience: NotificationAudience;
  /** Label on the preferences panel. */
  label: string;
  /** Short description on the preferences panel. */
  description: string;
  /**
   * Dedupe window in seconds. If the same `(userId, kind)` (and
   * dedupeKey, when set) has fired inside this window, we silently
   * collapse the duplicate. `0` = no dedupe (every event is its own
   * notification  placements, suspensions etc).
   */
  dedupeWindowSeconds: number;
}

export const NOTIFICATION_CATALOG = {
  "profile.viewed": {
    defaultInApp: false, // noisy when an employer refreshes
    defaultEmail: false,
    audience: "seeker",
    label: "An employer viewed your profile",
    description:
      "Quietly de-duplicated per organisation per day. Off by default to keep your bell calm.",
    dedupeWindowSeconds: 24 * 60 * 60,
  },
  "contact.revealed": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "seeker",
    label: "An employer revealed your contact",
    description:
      "POPIA: every reveal is audit-logged. You see it here too so trust runs both ways.",
    dedupeWindowSeconds: 0,
  },
  "document.downloaded": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "seeker",
    label: "An employer downloaded one of your documents",
    description: "Triggered when a verified employer downloads a qualification.",
    dedupeWindowSeconds: 0,
  },
  "placement.confirmed": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "seeker",
    label: "A placement was confirmed for you",
    description:
      "The employer logged the hire through Sebenza  this counts toward the national placement total.",
    dedupeWindowSeconds: 0,
  },
  "qualification.verified": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "seeker",
    label: "A qualification was verified",
    description: "Admins reviewed your evidence and confirmed it.",
    dedupeWindowSeconds: 0,
  },
  "qualification.rejected": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "seeker",
    label: "A qualification was rejected",
    description: "Includes the admin's reason so you can fix it and re-submit.",
    dedupeWindowSeconds: 0,
  },
  "account.suspended": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "self",
    label: "Your account was suspended",
    description: "You'll see the reason on your dashboard the next time you sign in.",
    dedupeWindowSeconds: 0,
  },
  "account.restored": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "self",
    label: "Your account was restored",
    description: "Access is back.",
    dedupeWindowSeconds: 0,
  },
  "org.verified": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "org_members",
    label: "Your organisation was verified",
    description: "Employer search is now unlocked for every member.",
    dedupeWindowSeconds: 0,
  },
  "org.rejected": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "org_members",
    label: "Your organisation submission was rejected",
    description: "Includes the admin's reason so you can re-submit.",
    dedupeWindowSeconds: 0,
  },
  "moderation.reported": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "all_admins",
    label: "A profile was reported",
    description: "Lands in /admin/moderation for triage.",
    dedupeWindowSeconds: 0,
  },
  "verification.queued": {
    defaultInApp: false, // high-volume; admins use the queue page
    defaultEmail: false,
    audience: "all_admins",
    label: "Something is awaiting verification",
    description: "Off by default. The queue page is the canonical surface.",
    dedupeWindowSeconds: 10 * 60,
  },
  "status.stale.warning": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "seeker",
    label: "Employment status nudges",
    description: "Phase 8 cron flips this on when your status hasn't been confirmed lately.",
    dedupeWindowSeconds: 7 * 24 * 60 * 60,
  },
  "saved_search.new_matches": {
    defaultInApp: true,
    defaultEmail: false,
    audience: "org_members",
    label: "New matches on a saved search",
    description: "Phase 8 cron rolls these up daily.",
    dedupeWindowSeconds: 24 * 60 * 60,
  },
  // ──────────────────────────────────────────────────────────────────────
  // Phase 9.8.4 + 9.8.5  vacancy invitations + responses.
  // Email defaults ON: these are transactional lifecycle events (a
  // specific action affecting a specific person) and read identically
  // to a verification email in intent. Recipients can still opt out
  // per kind in /dashboard/notifications/preferences. Sending is
  // additionally gated by the platform-wide
  // `feature_flag_email_notifications` killswitch.
  // ──────────────────────────────────────────────────────────────────────
  "vacancy.invite": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "seeker",
    label: "A verified employer flagged you for a specific role",
    description:
      "Sent when an employer invites you to a vacancy they're trying to fill. You can accept, decline, or decline with a reason. Declining is free  it never affects your visibility in search.",
    dedupeWindowSeconds: 0, // every distinct invite is its own notification
  },
  "vacancy.invite.expired": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "seeker",
    label: "A vacancy invite expired without a response",
    description:
      "Polite reminder when an invitation's response window passed. The role may have been filled in the meantime  no action required.",
    dedupeWindowSeconds: 0,
  },
  "vacancy.invite.unanswered": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "org_members",
    label: "An invited seeker didn't respond in time",
    description:
      "Fires nightly when a vacancy invitation passes its expiry window without an accept or decline. Helps you keep your pipeline honest.",
    dedupeWindowSeconds: 0,
  },
  "vacancy.response": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "org_members",
    label: "A seeker responded to a vacancy invitation",
    description:
      "Fires when an invited seeker accepts, accepts with notice, or declines. The decline-reason  if one was given  is included so you can read the market signal.",
    dedupeWindowSeconds: 0,
  },
  "vacancy.reconsider": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "org_members",
    label: "A seeker who previously declined wants to reconsider",
    description:
      "The change-of-mind path: a declined seeker tapped \"Express interest again.\" Human workflow, not a dead end  re-open the conversation if the role is still open.",
    dedupeWindowSeconds: 0,
  },
  // ──────────────────────────────────────────────────────────────────────
  // Phase 9.10  employer KYC / org-vetting lifecycle. Transactional
  // events; default ON like the vacancy + verification kinds.
  // Recipients can opt out per kind in /employer/notifications/
  // preferences. Sending is still gated by the platform-wide
  // `feature_flag_email_notifications` killswitch.
  // ──────────────────────────────────────────────────────────────────────
  "org.documents.submitted": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "org_members",
    label: "We received your verification application",
    description:
      "Confirmation that your onboarding documents were submitted. Our team typically reviews within one business day.",
    dedupeWindowSeconds: 0,
  },
  "org.review.changes": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "org_members",
    label: "Our team asked you to revise your application",
    description:
      "An admin requested specific changes to your onboarding submission. Your application form is open again with the admin's note pinned at the top  edit and resubmit.",
    dedupeWindowSeconds: 0,
  },
  // ──────────────────────────────────────────────────────────────────────
  // Phase 9.11  vacancy-outcome loop. Honest closure for accepted
  // invitees who weren't selected when the vacancy got filled. Body
  // composes vacancy requirements vs. the recipient's profile (NEVER
  // the hired person's data, per D4) and links to Career Compass for
  // any missing skills.
  // ──────────────────────────────────────────────────────────────────────
  "vacancy.outcome.other-hired": {
    defaultInApp: true,
    defaultEmail: true,
    audience: "seeker",
    label: "A vacancy you accepted was filled with someone else",
    description:
      "Honest closure when an employer hires someone else from a vacancy you accepted. Includes a comparison to the role's requirements (not the hired person's profile) and a Career Compass path for any skills the role wanted that your profile didn't show.",
    dedupeWindowSeconds: 0,
  },
} as const satisfies Record<string, NotificationKindMeta>;

export type NotificationKind = keyof typeof NOTIFICATION_CATALOG;

export interface NotificationPref {
  inApp: boolean;
  email: boolean;
}
export type NotificationPrefMap = Partial<Record<NotificationKind, NotificationPref>>;

export function defaultPrefFor(kind: NotificationKind): NotificationPref {
  const meta = NOTIFICATION_CATALOG[kind];
  return { inApp: meta.defaultInApp, email: meta.defaultEmail };
}

/**
 * Returns the effective preference (merged with catalog defaults).
 * Used both at write time (to silently skip when `inApp: false`) and
 * on the preferences UI to populate toggle states.
 */
export function effectivePref(
  prefs: NotificationPrefMap | null | undefined,
  kind: NotificationKind,
): NotificationPref {
  const stored = prefs?.[kind];
  const dflt = defaultPrefFor(kind);
  return {
    inApp: stored?.inApp ?? dflt.inApp,
    email: stored?.email ?? dflt.email,
  };
}
