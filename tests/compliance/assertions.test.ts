/**
 * Phase 12 (Task 12.4)  the runtime compliance suite, in CI.
 *
 * `lib/analytics/outcomes-compliance.ts` ships 29 runnable assertions that
 * previously only ran when an admin hit `/api/admin/outcomes-compliance`.
 * This suite runs every one of them against the seeded test database, each
 * as its own named test so a regression names the broken product rule.
 *
 * Discovery is dynamic: every exported `assert*` function is enrolled
 * automatically, so a future compliance assertion lands in CI the moment
 * it's written. The count fixture below is a floor (not an exact pin) 
 * it exists to catch accidental *removal* of assertions.
 */
import { describe, expect, test } from "vitest";
import * as compliance from "@/lib/analytics/outcomes-compliance";

interface AssertResult {
  ok: boolean;
  name: string;
  message: string;
}

type AssertFn = () => Promise<AssertResult>;

const assertions = Object.entries(compliance).filter(
  (entry): entry is [string, AssertFn] =>
    entry[0].startsWith("assert") && typeof entry[1] === "function",
);

describe("compliance assertion suite (lib/analytics/outcomes-compliance.ts)", () => {
  test("suite floor: at least the 29 assertions shipped through Phase 9.17 exist", () => {
    expect(assertions.length).toBeGreaterThanOrEqual(29);
  });

  test.each(assertions)("%s", async (_exportName, fn) => {
    const result = await fn();
    expect(result.ok, `${result.name}: ${result.message}`).toBe(true);
  });
});
