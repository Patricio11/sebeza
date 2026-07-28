/**
 * Phase 9  Rate limiter interface.
 *
 * Provider-agnostic so we can swap the storage layer without touching
 * the call sites. Default implementation is an in-memory sliding
 * window (fine for dev + single-instance prod); when
 * `UPSTASH_REDIS_REST_URL` is set, the Upstash adapter takes over for
 * cluster correctness.
 */

import "server-only";

export interface RateLimitResult {
  /** True when the request is within the budget. */
  ok: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Total budget for the window. */
  limit: number;
  /** Unix ms when the window resets. */
  resetAt: number;
}

export interface RateLimiter {
  /** Human-readable identifier for diagnostics. */
  name: string;
  /**
   * `key` is the identity to limit against (IP, userId, orgId, or a
   * compound like `revealContact:orgId:profileId`). `bucket` selects a
   * pre-registered budget by name.
   */
  check(bucket: BucketName, key: string): Promise<RateLimitResult>;
  /**
   * Phase 32.2.4b  report the remaining budget WITHOUT consuming any
   * of it.
   *
   * Needed for the auth buckets, where the thing worth counting is a
   * FAILED attempt. Counting successes too makes the limiter punish
   * the honest case: every seeker at one employer, campus lab, library
   * or internet café shares a public IP, and South African mobile
   * networks put whole cities behind carrier-grade NAT  so a
   * success-consuming counter locks out real users long before it
   * inconveniences an attacker. Call sites `peek` first, then `check`
   * only on the failure path.
   */
  peek(bucket: BucketName, key: string): Promise<RateLimitResult>;
}

export const BUCKETS = {
  /**
   * revealContact action  per (org member × profile) per hour.
   * Catches accidental tab-loops + deliberate scrape attempts. No
   * legitimate-user collision (revealing one person 20+ times in an
   * hour is the failure mode, not the use case).
   */
  "reveal": { limit: 20, windowSeconds: 60 * 60 },
  /**
   * uploadDocument / uploadPhoto  keeps storage costs sane against
   * a single user accidentally or maliciously pushing a flood.
   */
  "upload": { limit: 5, windowSeconds: 10 * 60 },
  /**
   * Public search GET  scraper guard. Generous; legitimate users
   * never hit this.
   */
  "search": { limit: 30, windowSeconds: 60 },
  /**
   * Phase 26.2  AI-coach practice calls per USER per day. The global
   * monthly LLM budget is shared across the whole platform; without a
   * per-user throttle one seeker could drain it. Ten practice rounds a
   * day is generous for a real user, ruinous for a loop.
   */
  "coach": { limit: 10, windowSeconds: 24 * 60 * 60 },
  /**
   * Phase 32.2.4  sign-in attempts per CLIENT IP.
   *
   * Keyed on IP, deliberately NOT on email: a per-email counter is a
   * denial-of-service vector (an attacker submits bad passwords for a
   * victim's address and locks them out). Per-IP throttling slows a
   * credential-stuffing run without giving anyone a lockout weapon.
   * 20 attempts in 10 minutes is far above honest use  a real person
   * mistyping their password three times never notices  and far below
   * what an automated run needs.
   */
  "signin": { limit: 20, windowSeconds: 10 * 60 },
  /**
   * Phase 32.2.4  TOTP / backup-code verification.
   *
   * THIS IS THE IMPORTANT ONE. A 6-digit TOTP is a 10^6 space with a
   * ~90-second validity window; unthrottled online guessing is a real
   * attack once an attacker holds the password. Better Auth ships a
   * `{window: 10, max: 3}` rule for its own /two-factor/* routes, but
   * that limiter only runs for requests through `auth.handler`  we
   * call `auth.api.verifyTOTP()` directly from a Server Action, so it
   * never applied. 5 per 5 minutes covers a user fumbling a code or
   * their clock drifting; it makes brute force hopeless.
   */
  "2fa-verify": { limit: 5, windowSeconds: 5 * 60 },
  /**
   * Phase 32.2.4  unauthenticated email sends (password reset,
   * verification resend). Both endpoints are public and were
   * unthrottled, so they could be used to flood a victim's mailbox
   * (burying a genuine security alert) or to burn the platform's SMTP
   * reputation and quota. Keyed per IP AND per address.
   */
  "email-send": { limit: 5, windowSeconds: 15 * 60 },
  /**
   * Phase 32.2.4  vacancy invitations per ORG. `bulkInviteToVacancy`
   * caps a single call at 50 profiles, but nothing capped the number of
   * calls, so the 50 was not a real ceiling. 10 batches an hour is a
   * busy recruiter; it is not a mass-messaging tool.
   */
  "invite": { limit: 10, windowSeconds: 60 * 60 },
  /**
   * Phase 32.3.8  anonymous abuse reports (`flagProfile`).
   *
   * Filing anonymously is deliberate and correct  a seeker reporting a
   * predatory employer must not have to identify themselves. But each
   * call inserts a `reports` row AND notifies every admin, so
   * unthrottled it is both a moderation-queue flood and a way to
   * mass-flag a competitor's seekers. Keyed per IP; generous enough
   * that a genuine reporter filing about several profiles is unaffected.
   */
  "report": { limit: 5, windowSeconds: 10 * 60 },
} as const;

export type BucketName = keyof typeof BUCKETS;

/**
 * Phase 32.2.4 (security remediation)  CORRECTION TO A PRIOR DECISION.
 *
 * The Phase 9 review (2026-05-23) recorded a deliberate choice NOT to
 * rate-limit sign-in, resting on three premises. The 2026-07-28 audit
 * found the load-bearing one to be false:
 *
 *   - "Better Auth handles it."  Better Auth's limiter is invoked from
 *     its HTTP router's `onRequest` hook, i.e. ONLY for requests through
 *     `/api/auth/*`. Sebenza calls `auth.api.signInEmail()` /
 *     `verifyTOTP()` directly from Server Actions, which never touch
 *     that hook. There was no limiter on the auth surface at all.
 *   - "scrypt is the mitigation."  True for offline cracking, but
 *     ~100-200ms per attempt is no obstacle to an online run against a
 *     6-digit TOTP.
 *   - "2FA covers high-value accounts."  `feature_flag_2fa_enforced`
 *     defaults to false.
 *
 * The DoS concern that motivated the original decision was correct and
 * is preserved: sign-in is limited per IP, never per email, so nobody
 * can lock a victim out of their own account.
 */
