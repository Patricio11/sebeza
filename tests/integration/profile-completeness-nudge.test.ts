/**
 * Day-after "finish your profile" nudge cron
 * (docs/SEEKER_ONBOARDING_POLISH_PLAN.md). Once ever per seeker, marked
 * on `profiles.profile_complete_notified_at`; fires on < 50% OR missing
 * main info (summary, 3+ skills, city); 24h grace; fail-closed auth.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { GET } from "@/app/api/cron/profile-completeness-nudge/route";

const db = getDb();
const PROFILE = "prof_lerato-n";
const USER = "user_lerato-n";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const TWO_DAYS_AGO = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const LONG_BIO = "Software developer in Gauteng with five years across web and data work.";

let original: {
  completeness: number;
  memberSince: Date;
  bio: string | null;
  city: string;
  profileCompleteNotifiedAt: Date | null;
} | null = null;

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

async function marker(): Promise<Date | null> {
  const [row] = await db
    .select({ at: schema.profiles.profileCompleteNotifiedAt })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, PROFILE));
  return row?.at ?? null;
}

async function clearBell() {
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, USER),
        eq(schema.notifications.kind, "profile.completeness.nudge"),
      ),
    );
}

async function reset() {
  await clearBell();
  await db
    .update(schema.profiles)
    .set({ profileCompleteNotifiedAt: null })
    .where(eq(schema.profiles.id, PROFILE));
}

beforeAll(async () => {
  const [row] = await db
    .select({
      completeness: schema.profiles.completeness,
      memberSince: schema.profiles.memberSince,
      bio: schema.profiles.bio,
      city: schema.profiles.city,
      profileCompleteNotifiedAt: schema.profiles.profileCompleteNotifiedAt,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, PROFILE));
  original = row ?? null;
  await reset();
});

afterAll(async () => {
  if (original) {
    await db.update(schema.profiles).set(original).where(eq(schema.profiles.id, PROFILE));
  }
  await clearBell();
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
    expect(await marker()).toBeNull();
  });

  test("fires once for an older incomplete profile, marks it, never repeats", async () => {
    await db
      .update(schema.profiles)
      .set({ completeness: 20, memberSince: TWO_DAYS_AGO() })
      .where(eq(schema.profiles.id, PROFILE));
    await run();
    expect(await nudgeCount()).toBe(1);
    expect(await marker()).not.toBeNull();
    // Even if the bell is cleared, the profile marker holds the line.
    await clearBell();
    await run();
    expect(await nudgeCount()).toBe(0);
  });

  test("fires on missing main info even at high completeness (no summary)", async () => {
    await reset();
    await db
      .update(schema.profiles)
      .set({ completeness: 80, bio: "", memberSince: TWO_DAYS_AGO() })
      .where(eq(schema.profiles.id, PROFILE));
    await run();
    expect(await nudgeCount()).toBe(1);
    const [n] = await db
      .select({ meta: schema.notifications.meta })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, USER),
          eq(schema.notifications.kind, "profile.completeness.nudge"),
        ),
      );
    expect((n?.meta as { missing?: string[] } | null)?.missing).toContain("summary");
  });

  test("never fires for a profile at 50%+ with the main info in place", async () => {
    await reset();
    await db
      .update(schema.profiles)
      .set({
        completeness: 50,
        bio: LONG_BIO,
        city: "johannesburg",
        memberSince: TWO_DAYS_AGO(),
      })
      .where(eq(schema.profiles.id, PROFILE));
    await run();
    expect(await nudgeCount()).toBe(0);
    expect(await marker()).toBeNull();
  });
});
