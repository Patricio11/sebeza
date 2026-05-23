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
} as const;

export type BucketName = keyof typeof BUCKETS;

/**
 * Note (Phase 9 review, 2026-05-23): we intentionally do NOT
 * rate-limit sign-in. Better Auth's scrypt password hashing is the
 * brute-force mitigation; 2FA is the second factor for high-value
 * accounts; a per-email rate limit would create a denial-of-service
 * vector (locking out the legitimate user by submitting their email
 * with bad passwords). See `lib/auth/actions.ts signIn` for the
 * decision record.
 */
