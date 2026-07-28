/**
 * Phase 32.3.9 (security remediation)  sign-up must not reveal whether
 * an address already has an account.
 *
 * The bug this pins: a duplicate address returned "An account with this
 * email already exists. Try signing in instead." and, via a
 * `return e.message` fallthrough, Better Auth's own
 * `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`. That made sign-up the easy
 * oracle, undoing the careful anti-enumeration work on the password
 * reset and verification-resend paths.
 *
 * Why this matters MORE on this platform than most: confirming an
 * address has a Sebenza account can reveal that a specific person is
 * job-hunting  precisely the inference a current employer must not be
 * able to draw about their own staff.
 *
 * The fix returns the SAME shape as a real sign-up and emails the
 * genuine owner instead ("you already have an account, sign in"), so the
 * honest forgetful user still gets guidance  delivered to the address
 * only they control  while an attacker learns nothing.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { signUpSeeker } from "@/lib/auth/actions";
import { __resetRateLimiterForTests } from "@/lib/rate-limit/memory";
import type { ConsentPurpose } from "@/lib/consent";

const db = getDb();

/** An address that definitely exists in the seed. */
const EXISTING = "andile-z@example.co.za";
/** An address that definitely does not. */
const FRESH = `phase32-enum-${Date.now()}@example.co.za`;

function signUpPayload(email: string) {
  return {
    fullName: "Enumeration Probe",
    email,
    dateOfBirth: "1995-05-05",
    nationality: "ZA",
    password: "a-perfectly-fine-password-1",
    grantedConsents: ["searchability"] as ConsentPurpose[],
    termsAccepted: true as const,
    profession: "Software Developer",
    province: "gauteng",
    status: "open_to_work" as const,
    academic: null,
  };
}

afterAll(async () => {
  // Remove anything the fresh sign-up created so re-runs stay clean.
  const rows = await db
    .select({ id: schema.appUser.id })
    .from(schema.appUser)
    .where(eq(schema.appUser.email, FRESH));
  const id = rows[0]?.id;
  if (id) {
    await db.delete(schema.session).where(eq(schema.session.userId, id));
    await db.delete(schema.consents).where(eq(schema.consents.userId, id));
    await db.delete(schema.profiles).where(eq(schema.profiles.userId, id));
    await db.delete(schema.account).where(eq(schema.account.userId, id));
    await db.delete(schema.appUser).where(eq(schema.appUser.id, id));
  }
});

describe("Phase 32.3.9  sign-up does not disclose account existence", () => {
  test("a duplicate address returns the SAME shape as a fresh sign-up", async () => {
    __resetRateLimiterForTests();

    const duplicate = await signUpSeeker(signUpPayload(EXISTING));
    const fresh = await signUpSeeker(signUpPayload(FRESH));

    expect(
      fresh.ok,
      "the control case must succeed, or this test proves nothing",
    ).toBe(true);
    expect(
      duplicate.ok,
      "a duplicate address must LOOK like a successful sign-up",
    ).toBe(true);

    if (duplicate.ok && fresh.ok) {
      expect(
        (duplicate as { next?: string }).next,
        "both must route to the same place",
      ).toBe((fresh as { next?: string }).next);
    }
  });

  test("no response text hints that the account exists", async () => {
    __resetRateLimiterForTests();
    const res = await signUpSeeker(signUpPayload(EXISTING));
    const serialised = JSON.stringify(res).toLowerCase();

    for (const tell of [
      "already exists",
      "already have",
      "user_already_exists",
      "duplicate",
      "sign in instead",
    ]) {
      expect(serialised, `response must not contain "${tell}"`).not.toContain(
        tell,
      );
    }
  });

  test("the duplicate attempt creates NO second account", async () => {
    __resetRateLimiterForTests();
    await signUpSeeker(signUpPayload(EXISTING));

    const rows = await db
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, EXISTING));
    expect(rows.length, "exactly one account for the address").toBe(1);
  });
});
