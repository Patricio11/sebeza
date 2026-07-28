/**
 * Phase 32.2.2 (security remediation)  sign-in must not disclose account
 * state, and must never echo an admin's internal moderation note.
 *
 * The bug this pins: the suspension / erasure lookup ran BEFORE the
 * password was verified and returned
 *
 *     `Your account is suspended: <suspendedReason>`
 *
 * where `suspendedReason` is the admin's verbatim free-text assessment
 * ("suspected fraudulent CIPC docs, see ticket 4412"). Anyone who knew
 * an email address could therefore learn, with NO credential at all,
 * that the account existed, what its moderation state was, and what an
 * administrator privately wrote about it. That is an account-enumeration
 * oracle and a POPIA disclosure to an unauthenticated party in one.
 *
 * The property asserted here is the one that matters: **with a wrong
 * password, a suspended account and a healthy account are
 * indistinguishable, and the admin's note never appears.**
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { signIn } from "@/lib/auth/actions";

const db = getDb();

const SUSPENDED = {
  userId: "user_thandeka-m",
  email: "thandeka-m@example.co.za",
};
const HEALTHY = { email: "andile-z@example.co.za" };
const WRONG_PASSWORD = "definitely-not-the-password-42";

/** The exact free-text an admin might write — must never reach a client. */
const SECRET_NOTE =
  "Suspected fraudulent CIPC documents, see internal ticket 4412.";

async function setSuspended(on: boolean) {
  await db
    .update(schema.appUser)
    .set(
      on
        ? { suspendedAt: new Date(), suspendedReason: SECRET_NOTE }
        : { suspendedAt: null, suspendedReason: null },
    )
    .where(eq(schema.appUser.id, SUSPENDED.userId));
}

beforeEach(async () => {
  await setSuspended(false);
});

afterAll(async () => {
  await setSuspended(false);
  await db
    .delete(schema.session)
    .where(eq(schema.session.userId, SUSPENDED.userId));
});

describe("Phase 32.2.2  sign-in discloses nothing pre-authentication", () => {
  test("a suspended account with a WRONG password is indistinguishable from a healthy one", async () => {
    await setSuspended(true);
    const suspended = await signIn({
      email: SUSPENDED.email,
      password: WRONG_PASSWORD,
    });
    const healthy = await signIn({
      email: HEALTHY.email,
      password: WRONG_PASSWORD,
    });

    expect(suspended.ok).toBe(false);
    expect(healthy.ok).toBe(false);
    if (!suspended.ok && !healthy.ok) {
      expect(
        suspended.message,
        "a wrong password must produce the SAME message whatever the account's moderation state",
      ).toBe(healthy.message);
    }
  });

  test("the admin's internal note never reaches the client", async () => {
    await setSuspended(true);
    const res = await signIn({
      email: SUSPENDED.email,
      password: WRONG_PASSWORD,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).not.toContain("CIPC");
      expect(res.message).not.toContain("4412");
      expect(res.message.toLowerCase()).not.toContain("suspend");
    }
  });

  test("an unknown address is indistinguishable from a real one", async () => {
    const unknown = await signIn({
      email: "nobody-here-at-all@example.co.za",
      password: WRONG_PASSWORD,
    });
    const known = await signIn({
      email: HEALTHY.email,
      password: WRONG_PASSWORD,
    });
    expect(unknown.ok).toBe(false);
    expect(known.ok).toBe(false);
    if (!unknown.ok && !known.ok) {
      expect(unknown.message).toBe(known.message);
    }
  });

  test("with the CORRECT password a suspended user is told honestly — but never the reason, and gets no session", async () => {
    // Reaching this branch proves the caller owns the credentials, so an
    // honest "you are suspended" is safe and is better UX than a vague
    // refusal. The admin's internal note still stays internal.
    await setSuspended(true);
    const res = await signIn({
      email: SUSPENDED.email,
      password: "sebenza-dev-2026", // the seed password
    });

    expect(res.ok, "a suspended account must not be signed in").toBe(false);
    if (!res.ok) {
      expect(res.message.toLowerCase()).toContain("suspended");
      expect(res.message).not.toContain("CIPC");
      expect(res.message).not.toContain("4412");
    }

    // Better Auth issues a session as soon as the password checks out —
    // the moderation gate must destroy it, or the suspended user walks
    // away holding a valid cookie.
    const live = await db
      .select({ id: schema.session.id })
      .from(schema.session)
      .where(eq(schema.session.userId, SUSPENDED.userId));
    expect(
      live.length,
      "the session issued for the accepted password must be revoked",
    ).toBe(0);
  });

  test("an erased account with a WRONG password also stays indistinguishable", async () => {
    await db
      .update(schema.appUser)
      .set({ deletedAt: new Date() })
      .where(eq(schema.appUser.id, SUSPENDED.userId));
    try {
      const erased = await signIn({
        email: SUSPENDED.email,
        password: WRONG_PASSWORD,
      });
      const healthy = await signIn({
        email: HEALTHY.email,
        password: WRONG_PASSWORD,
      });
      expect(erased.ok).toBe(false);
      if (!erased.ok && !healthy.ok) {
        expect(erased.message).toBe(healthy.message);
        expect(erased.message.toLowerCase()).not.toContain("erase");
      }
    } finally {
      await db
        .update(schema.appUser)
        .set({ deletedAt: null })
        .where(eq(schema.appUser.id, SUSPENDED.userId));
    }
  });
});
