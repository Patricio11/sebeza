/**
 * Phase 9 — In-memory sliding-window rate limiter.
 *
 * Fine for dev + single-instance production. When the deployment goes
 * multi-instance, the Upstash adapter takes over (set
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in env). The
 * interface in `./types` is the seam.
 *
 * Sliding window approximation: we keep a circular buffer of the last
 * N hit timestamps per key; on each check we count entries inside the
 * window. Simpler + cheaper than true sliding logs at the budgets we
 * use.
 */

import "server-only";
import { BUCKETS, type BucketName, type RateLimitResult, type RateLimiter } from "./types";

interface Entry {
  hits: number[];
}

const store = new Map<string, Entry>();

function gc(now: number, windowMs: number, entry: Entry): void {
  // Drop hits outside the window. Mutates in place; cheap for the
  // small windows we use (< 1000 entries per key in any plausible
  // scenario).
  const cutoff = now - windowMs;
  while (entry.hits.length > 0 && entry.hits[0]! < cutoff) {
    entry.hits.shift();
  }
}

export const memoryRateLimiter: RateLimiter = {
  name: "memory",
  async check(bucket: BucketName, key: string): Promise<RateLimitResult> {
    const cfg = BUCKETS[bucket];
    const now = Date.now();
    const windowMs = cfg.windowSeconds * 1000;
    const compoundKey = `${bucket}:${key}`;
    const entry = store.get(compoundKey) ?? { hits: [] };
    gc(now, windowMs, entry);

    const remainingBefore = cfg.limit - entry.hits.length;
    if (remainingBefore <= 0) {
      const oldest = entry.hits[0] ?? now;
      return {
        ok: false,
        remaining: 0,
        limit: cfg.limit,
        resetAt: oldest + windowMs,
      };
    }

    entry.hits.push(now);
    store.set(compoundKey, entry);
    return {
      ok: true,
      remaining: remainingBefore - 1,
      limit: cfg.limit,
      resetAt: now + windowMs,
    };
  },
};
