/**
 * Phase 12 (Task 12.1) — in-memory sliding-window rate limiter fixtures.
 *
 * The limiter is DORMANT in production today (DPIA R8 trade-off — no call
 * sites wired), but Phase 12 tests it anyway: when abuse is observed
 * post-launch the operator flips it on, and it must be correct on day one,
 * not debugged mid-incident. Covers: budget exhaustion, window roll-over,
 * per-key + per-bucket isolation, and the result-shape contract.
 *
 * Uses fake timers — the window logic runs on Date.now().
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { memoryRateLimiter } from "./memory";
import { BUCKETS } from "./types";

const T0 = new Date("2026-06-10T08:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

// Unique keys per test so the module-level store can't leak across fixtures.
let seq = 0;
function freshKey(): string {
  return `test-key-${++seq}`;
}

describe("budget exhaustion (upload bucket: 5 per 10 min)", () => {
  test("allows exactly the budget, then refuses with remaining=0", async () => {
    const key = freshKey();
    for (let i = 0; i < BUCKETS.upload.limit; i++) {
      const r = await memoryRateLimiter.check("upload", key);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(BUCKETS.upload.limit - 1 - i);
    }
    const refused = await memoryRateLimiter.check("upload", key);
    expect(refused.ok).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.limit).toBe(BUCKETS.upload.limit);
  });

  test("refusal reports when the window resets (oldest hit + window)", async () => {
    const key = freshKey();
    for (let i = 0; i < BUCKETS.upload.limit; i++) {
      await memoryRateLimiter.check("upload", key);
    }
    const refused = await memoryRateLimiter.check("upload", key);
    expect(refused.resetAt).toBe(T0 + BUCKETS.upload.windowSeconds * 1000);
  });
});

describe("window roll-over", () => {
  test("budget restores after the window elapses", async () => {
    const key = freshKey();
    for (let i = 0; i < BUCKETS.upload.limit; i++) {
      await memoryRateLimiter.check("upload", key);
    }
    expect((await memoryRateLimiter.check("upload", key)).ok).toBe(false);

    vi.setSystemTime(T0 + BUCKETS.upload.windowSeconds * 1000 + 1);
    const after = await memoryRateLimiter.check("upload", key);
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(BUCKETS.upload.limit - 1);
  });

  test("sliding (not fixed) window: a mid-window hit keeps its own expiry", async () => {
    const key = freshKey();
    const windowMs = BUCKETS.upload.windowSeconds * 1000;
    // 4 hits at T0, 1 hit halfway through the window → budget full.
    for (let i = 0; i < 4; i++) await memoryRateLimiter.check("upload", key);
    vi.setSystemTime(T0 + windowMs / 2);
    await memoryRateLimiter.check("upload", key);
    expect((await memoryRateLimiter.check("upload", key)).ok).toBe(false);

    // Just past T0+window: the 4 early hits expired, the halfway hit hasn't.
    vi.setSystemTime(T0 + windowMs + 1);
    const r = await memoryRateLimiter.check("upload", key);
    expect(r.ok).toBe(true);
    // 1 surviving hit + this one → 5 - 2 = 3 remaining.
    expect(r.remaining).toBe(BUCKETS.upload.limit - 2);
  });
});

describe("isolation", () => {
  test("keys are isolated: exhausting one never affects another", async () => {
    const a = freshKey();
    const b = freshKey();
    for (let i = 0; i < BUCKETS.upload.limit; i++) {
      await memoryRateLimiter.check("upload", a);
    }
    expect((await memoryRateLimiter.check("upload", a)).ok).toBe(false);
    expect((await memoryRateLimiter.check("upload", b)).ok).toBe(true);
  });

  test("buckets are isolated: the same key has independent budgets", async () => {
    const key = freshKey();
    for (let i = 0; i < BUCKETS.upload.limit; i++) {
      await memoryRateLimiter.check("upload", key);
    }
    expect((await memoryRateLimiter.check("upload", key)).ok).toBe(false);
    expect((await memoryRateLimiter.check("search", key)).ok).toBe(true);
    expect((await memoryRateLimiter.check("reveal", key)).ok).toBe(true);
  });
});

describe("bucket budget contract (DPIA R8 documented values)", () => {
  test("reveal 20/hour · upload 5/10min · search 30/min", () => {
    expect(BUCKETS.reveal).toEqual({ limit: 20, windowSeconds: 3600 });
    expect(BUCKETS.upload).toEqual({ limit: 5, windowSeconds: 600 });
    expect(BUCKETS.search).toEqual({ limit: 30, windowSeconds: 60 });
  });
});
