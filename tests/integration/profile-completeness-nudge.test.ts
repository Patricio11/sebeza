/**
 * The 50% nudge cron (docs/SEEKER_ONBOARDING_POLISH_PLAN.md).
 *
 * Properties: fires only for profiles older than 24h AND under 50%
 * complete; never twice for the same person; never for deleted or
 * suspended accounts; the notification names what is missing.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/cache")>();
  return { ...original, revalidatePath: vi.fn(), revalidateTag: vi.fn() };
});

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { GET } from "@/app/api/cron/profile-completeness-nudge/route";

const db = getDb();
const PROFILE = "prof_lerato-n";
const USER = "user_lerato-n";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

let original: { completeness: number; memberSince: Date } | null = null;

function run() {
  return GET(
    new Request("http://localhost/api/cron/profile-completeness-nudge", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }),
  );
}

async function nudgeCount(): Promise<number> {
  const rows = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, USER),
        eq(schema.notifications.kind, "profile.completeness.nudge"),
      ),
    );
  return rows.length;
}

beforeAll(async () => {
  const [row] = await db
    .select({
      completeness: schema.profiles.completeness,
      memberSince: schema.profiles.memberSince,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, PROFILE));
  original = row ?? null;
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, USER),
        eq(schema.notifications.kind, "profile.completeness.nudge"),
      ),
    );
});

afterAll(async () => {
  if (original) {
    await db
      .update(schema.profiles)
      .set({ completeness: original.completeness, memberSince: original.memberSince })
      .where(eq(schema.profiles.id, PROFILE));
  }
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, USER),
        eq(schema.notifications.kind, "profile.completeness.nudge"),
      ),
    );
});

describe("profile-completeness-nudge cron", () => {
  test("refuses without the cron secret", async () => {
    const res = await GET(new Request("http://localhost/api/cron/profile-completeness-nudge"));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("skips a fresh signup even when incomplete (24h grace)", async () => {
    await db
      .update(schema.profiles)
      .set({ completeness: 20, memberSince: new Date() })
      .where(eq(schema.profiles.id, PROFILE));
    const res = await run();
    expect(res.status).toBe(200);
    expect(await nudgeCount()).toBe(0);
  });

  test("fires once for an older incomplete profile, then never again", async () => {
    await db
      .update(schema.profiles)
      .set({
        completeness: 20,
        memberSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      })
      .where(eq(schema.profiles.id, PROFILE));
    await run();
    expect(await nudgeCount()).toBe(1);
    await run();
    expect(await nudgeCount()).toBe(1);
  });

  test("never fires for a profile at or above 50%", async () => {
    await db
      .delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, USER),
          eq(schema.notifications.kind, "profile.completeness.nudge"),
        ),
      );
    await db
      .update(schema.profiles)
      .set({
        completeness: 50,
        memberSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      })
      .where(eq(schema.profiles.id, PROFILE));
    await run();
    expect(await nudgeCount()).toBe(0);
  });
});
