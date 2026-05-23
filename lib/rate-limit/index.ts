/**
 * Phase 9  Rate limiter resolver + convenience wrapper.
 *
 * STATUS (2026-05-23): dormant by default  no call sites wired.
 *
 * Why dormant: the project decision is to NOT pre-emptively rate-limit
 * before we see real abuse. Pre-emptive rate limits trade real
 * legitimate-user friction (and operational complexity) for theoretical
 * defence. The existing controls  verified-org gates, per-action
 * consent checks, the 30-day reveal-gate window, audit logging,
 * scrypt-hashed passwords, 2FA on privileged roles  carry the load.
 *
 * The module exists ready-to-wire. To re-enable for a specific
 * action, import `enforce` from this module and gate the action:
 *
 *   const r = await enforce("reveal", `${orgId}:${profileId}`);
 *   if (!r.ok) return fail("Too many reveals  slow down.");
 *
 * `getRateLimiter()` returns the configured implementation:
 *   - memory (dev + single-instance default)
 *   - upstash (when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *     are present; not implemented yet  the Upstash adapter is one
 *     file behind a flag-flip when the production deployment lands)
 */

import "server-only";
import { memoryRateLimiter } from "./memory";
import type { BucketName, RateLimitResult, RateLimiter } from "./types";

let cached: RateLimiter | null = null;

function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  // Future: when UPSTASH_REDIS_REST_URL is set, resolve to the
  // upstash adapter. For now memory is the only registered impl.
  cached = memoryRateLimiter;
  return cached;
}

export async function enforce(
  bucket: BucketName,
  key: string,
): Promise<RateLimitResult> {
  const limiter = getRateLimiter();
  return limiter.check(bucket, key);
}

export type { RateLimitResult, BucketName } from "./types";
