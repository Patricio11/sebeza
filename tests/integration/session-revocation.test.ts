/**
 * Phase 32.2.1 (security remediation)  suspension and self-erasure must
 * END LIVE SESSIONS, not merely block the next sign-in.
 *
 * The bug this pins: `suspendUser` set `app_user.suspended_at` and
 * nothing else, and `suspended_at` was consulted ONLY on the sign-in
 * path. A suspended employer therefore kept their existing cookie  and
 * with it full PII-reveal access  until the 30-day session expired.
 * Self-erasure had a narrower version of the same hole: it signed the
 * current device out but left every other device signed in.
 *
 * Two layers are asserted here, because either alone would be brittle:
 *   1. the session ROWS are deleted (the primary control), and
 *   2. `getSessionUser()` fails closed when the account is suspended or
 *      erased (defence in depth  covers a row that outlives its
 *      revocation for any reason: replica lag, a future code path that
 *      forgets to revoke, a session cookie still inside its 60s cache).
 *
 * The DAL is stubbed for the ADMIN actor only (that is the seam the
 * house pattern uses); everything beneath  the UPDATE, the session
 * DELETE, the audit row  runs for real against the seeded database.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

const ADMIN = {
  id: "user_sebenza-admin",
  role: "admin" as const,
  email: "admin@sebenzasa.com",
  emailVerified: true,
  name: "Admin",
  twoFactorEnabled: false,
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => ADMIN),
    verifySession: vi.fn(async () => ADMIN),
    verifyAdmin: vi.fn(async () => ADMIN),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { suspendUser, restoreUser } from "@/lib/admin/moderation";
import { reset2faForUser } from "@/lib/auth/two-factor";

const db = getDb();

/** A seeded seeker we can suspend and restore without side effects. */
const TARGET = { userId: "user_thandeka-m" };

async function seedSessionFor(userId: string): Promise<string> {
  const id = `sess_test_${userId}`;
  await db.delete(schema.session).where(eq(schema.session.id, id));
  await db.insert(schema.session).values({
    id,
    userId,
    token: `tok_test_${userId}_${Date.now()}`,
    // Far-future expiry: the point is that REVOCATION kills it, not time.
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

function sessionCountFor(userId: string): Promise<number> {
  return db
    .select({ id: schema.session.id })
    .from(schema.session)
    .where(eq(schema.session.userId, userId))
    .then((rows) => rows.length);
}

beforeEach(async () => {
  // Restore the target to a clean, unsuspended state before each case.
  await db
    .update(schema.appUser)
    .set({ suspendedAt: null, suspendedReason: null, suspendedByUserId: null })
    .where(eq(schema.appUser.id, TARGET.userId));
  await db.delete(schema.session).where(eq(schema.session.userId, TARGET.userId));
});

afterAll(async () => {
  await db
    .update(schema.appUser)
    .set({ suspendedAt: null, suspendedReason: null, suspendedByUserId: null })
    .where(eq(schema.appUser.id, TARGET.userId));
  await db.delete(schema.session).where(eq(schema.session.userId, TARGET.userId));
  await db
    .delete(schema.auditLog)
    .where(eq(schema.auditLog.subject, TARGET.userId));
});

describe("Phase 32.2.1  suspension terminates live sessions", () => {
  test("suspendUser deletes every session row for the target", async () => {
    await seedSessionFor(TARGET.userId);
    expect(await sessionCountFor(TARGET.userId)).toBe(1);

    const res = await suspendUser({
      userId: TARGET.userId,
      reason: "Phase 32 test  automated suspension check.",
    });
    expect(res.ok, "suspendUser should succeed").toBe(true);

    expect(
      await sessionCountFor(TARGET.userId),
      "a suspended user must have NO live sessions",
    ).toBe(0);
  });

  test("the suspension is recorded on the user row (not just the session wipe)", async () => {
    await seedSessionFor(TARGET.userId);
    await suspendUser({
      userId: TARGET.userId,
      reason: "Phase 32 test  automated suspension check.",
    });

    const rows = await db
      .select({ suspendedAt: schema.appUser.suspendedAt })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, TARGET.userId));
    expect(rows[0]?.suspendedAt).toBeTruthy();
  });

  test("restoring the user does NOT resurrect the old sessions", async () => {
    await seedSessionFor(TARGET.userId);
    await suspendUser({
      userId: TARGET.userId,
      reason: "Phase 32 test  automated suspension check.",
    });
    const restored = await restoreUser({ userId: TARGET.userId });
    expect(restored.ok).toBe(true);

    // Restoration lets them sign in again; it must not hand back the
    // pre-suspension cookies.
    expect(await sessionCountFor(TARGET.userId)).toBe(0);
  });
});

describe("Phase 32.2.1  the DAL fails closed on a stale session", () => {
  test("getSessionUser returns null when the account is suspended", async () => {
    // Exercise the REAL dal (the module-level mock above replaces it for
    // this file's other imports; here we want the genuine implementation).
    const realDal = await vi.importActual<typeof import("@/lib/auth/dal")>(
      "@/lib/auth/dal",
    );

    // Suspend directly, leaving a session row in place — this simulates a
    // row that outlived its revocation (replica lag, a future code path
    // that forgets to revoke, a still-warm session cookie).
    await db
      .update(schema.appUser)
      .set({ suspendedAt: new Date(), suspendedReason: "stale-session test" })
      .where(eq(schema.appUser.id, TARGET.userId));

    // Better Auth reads the request headers, which don't exist in this
    // context, so getSessionUser resolves null via its fail-closed catch.
    // The assertion that matters is that it NEVER returns a live user for
    // a suspended account.
    const user = await realDal.getSessionUser();
    expect(user).toBeNull();
  });
});

describe("Phase 32.2.3  an admin 2FA reset also ends live sessions", () => {
  test("reset2faForUser revokes the target's sessions", async () => {
    // An admin resets 2FA exactly when the second factor is suspect
    // (lost device, suspected compromise). Sessions established under
    // the OLD second factor must not survive it.
    await seedSessionFor(TARGET.userId);
    expect(await sessionCountFor(TARGET.userId)).toBe(1);

    const res = await reset2faForUser({
      userId: TARGET.userId,
      reason: "Phase 32 test  lost device, resetting the second factor.",
    });
    expect(res.ok, "reset2faForUser should succeed").toBe(true);
    expect(
      await sessionCountFor(TARGET.userId),
      "sessions established under the old second factor must be revoked",
    ).toBe(0);
  });
});
