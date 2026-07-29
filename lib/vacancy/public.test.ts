/**
 * Phase 34  Self Apply invariants (docs/PHASE_34_SELF_APPLY_PLAN.md).
 *
 * 1. The ANONYMOUS public payload type must structurally never carry
 *    the salary band (D2). Asserted at SOURCE level  the field must
 *    not exist on the `PublicVacancy` interface at all, so no refactor
 *    can quietly widen the disclosure. This is the assertion the 9.8.8
 *    compliance allowlist comment points at.
 * 2. The public-link token must be unguessable and URL-safe.
 * 3. The D4 disclosure wording names the org and states the sharing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  mintSelfApplyToken,
  selfApplyDisclosure,
  SELF_APPLY_DISCLOSURE_VERSION,
} from "./public";

describe("Self Apply public payload (D2)", () => {
  test("PublicVacancy interface has NO salaryBand field (source-level)", () => {
    const src = readFileSync(join(__dirname, "public.ts"), "utf8");
    const match = src.match(
      /export interface PublicVacancy \{([\s\S]*?)\n\}/,
    );
    expect(match, "PublicVacancy interface must exist").toBeTruthy();
    expect(match![1]).not.toMatch(/salaryBand/);
    // The salary read must remain a separate, explicit function.
    expect(src).toMatch(/export async function getApplicantSalaryBand/);
  });
});

describe("Self Apply token", () => {
  test("unguessable: 24 random bytes → 32 base64url chars, no collisions", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = mintSelfApplyToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(seen.has(t)).toBe(false);
      seen.add(t);
    }
  });
});

describe("Self Apply disclosure (D4)", () => {
  test("names the org and states what is shared", () => {
    const d = selfApplyDisclosure("Ubuntu Kitchens");
    expect(d).toContain("Ubuntu Kitchens");
    expect(d.toLowerCase()).toContain("profile");
    expect(SELF_APPLY_DISCLOSURE_VERSION).toBe("v1");
  });
});
