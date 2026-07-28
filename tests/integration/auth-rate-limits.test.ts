/**
 * Phase 32.2.4 (security remediation)  the auth surface is throttled.
 *
 * The bug this pins is a WRONG PREMISE rather than a missing line. The
 * Phase 9 review deliberately skipped sign-in rate limiting on the
 * grounds that "Better Auth handles it". Better Auth's limiter is
 * invoked from its HTTP router's `onRequest` hook  i.e. only for
 * requests through `/api/auth/*`. Sebenza calls `auth.api.signInEmail()`
 * and `auth.api.verifyTOTP()` DIRECTLY from Server Actions, which never
 * reach that hook, so nothing was throttling the auth surface at all.
 * A 6-digit TOTP (10^6, ~90s window) was therefore brute-forceable
 * online by anyone holding the password.
 *
 * What is asserted here:
 *   1. sign-in stops accepting attempts once the per-IP budget is spent;
 *   2. TOTP verification does the same, on a much tighter budget;
 *   3. the anti-enumeration contract SURVIVES throttling  a limited
 *      password-reset request still returns ok(), so the response
 *      cannot be used to detect the limit or probe for accounts;
 *   4. sign-in is keyed per IP and NEVER per email, so an attacker
 *      cannot lock a victim out of their own account (the DoS concern
 *      that motivated the original decision  still correct, preserved).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { BUCKETS } from "@/lib/rate-limit/types";
import { __resetRateLimiterForTests } from "@/lib/rate-limit/memory";
import { signIn, requestPasswordReset } from "@/lib/auth/actions";
import { verifyTotp } from "@/lib/auth/two-factor";

const WRONG_PASSWORD = "not-the-password-at-all-99";

beforeEach(() => {
  __resetRateLimiterForTests();
});

describe("Phase 32.2.4  sign-in is throttled per IP", () => {
  test("attempts are refused once the budget is spent", async () => {
    const budget = BUCKETS.signin.limit;

    // Burn the budget. Every one of these fails on credentials, which is
    // the point: a wrong password must still consume the allowance.
    for (let i = 0; i < budget; i++) {
      const r = await signIn({
        email: "andile-z@example.co.za",
        password: `${WRONG_PASSWORD}-${i}`,
      });
      expect(r.ok).toBe(false);
    }

    const limited = await signIn({
      email: "andile-z@example.co.za",
      password: WRONG_PASSWORD,
    });
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      expect(limited.message.toLowerCase()).toContain("too many");
    }
  });

  test("the limit is keyed per IP, NOT per email — a victim cannot be locked out", async () => {
    // Burn the budget against ONE address...
    for (let i = 0; i < BUCKETS.signin.limit; i++) {
      await signIn({ email: "victim@example.co.za", password: `x-${i}` });
    }
    // ...and confirm the refusal is about the caller, not the account:
    // a DIFFERENT address from the same client is refused identically.
    // (If the key were the email, this second address would still have a
    // full budget — that asymmetry is exactly what would let an attacker
    // lock a specific victim out.)
    const other = await signIn({
      email: "andile-z@example.co.za",
      password: WRONG_PASSWORD,
    });
    expect(other.ok).toBe(false);
    if (!other.ok) {
      expect(other.message.toLowerCase()).toContain("too many");
    }
  });
});

describe("Phase 32.2.4  TOTP verification is throttled", () => {
  test("codes are refused once the (much tighter) budget is spent", async () => {
    const budget = BUCKETS["2fa-verify"].limit;
    expect(budget).toBeLessThanOrEqual(10); // brute force must stay hopeless

    for (let i = 0; i < budget; i++) {
      const r = await verifyTotp({ code: String(100000 + i) });
      expect(r.ok).toBe(false);
    }

    const limited = await verifyTotp({ code: "999999" });
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      expect(limited.message.toLowerCase()).toContain("too many");
    }
  });
});

describe("Phase 32.2.4  throttling does not break anti-enumeration", () => {
  test("a rate-limited password-reset request still returns ok()", async () => {
    // The response must stay indistinguishable whether the address
    // exists, does not exist, or the caller has been throttled —
    // otherwise the limit itself becomes the oracle.
    for (let i = 0; i < BUCKETS["email-send"].limit + 3; i++) {
      const r = await requestPasswordReset({ email: "andile-z@example.co.za" });
      expect(
        r.ok,
        "requestPasswordReset must ALWAYS return ok(), throttled or not",
      ).toBe(true);
    }
  });
});
