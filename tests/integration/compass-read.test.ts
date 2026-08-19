/**
 * 2026-08-19  "Coach's read", against the real database.
 *
 * Contracts:
 *   - coach flag OFF → refuses before any provider interaction
 *   - a cached row with a MATCHING input hash returns without provider,
 *     throttle, or spend (flag still required)
 *   - the moderation backstop catches promises / URLs / contact details
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

let flagValue = false;
vi.mock("@/lib/admin/settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/settings")>();
  return {
    ...original,
    getSetting: vi.fn(async (key: string) =>
      key === "feature_flag_seeker_ai_coach"
        ? flagValue
        : original.getSetting(key as never),
    ),
  };
});

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  generateCompassRead,
  compassInputHash,
  narrativeViolations,
  type CompassReadInput,
} from "@/lib/llm/compass-read";

const db = getDb();
let profileId = "";

async function baseInput(): Promise<CompassReadInput> {
  if (!profileId) {
    const [row] = await db
      .select({ id: schema.profiles.id, userId: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.handle, "andile-z"))
      .limit(1);
    profileId = row!.id;
  }
  return {
    callerUserId: "user_test-read",
    profileId,
    profession: "Software Developer",
    province: "Gauteng",
    skills: [["Python", 3]],
    gaps: [["Docker", 12]],
    demandBasis: "local",
    paths: [["Docker Basics", "Coursera", "free", 6]],
    rank: { current: 4, projected: 2 },
  };
}

afterAll(async () => {
  await db
    .delete(schema.compassReads)
    .where(eq(schema.compassReads.profileId, profileId));
});

describe("coach's read", () => {
  test("flag OFF → refused", async () => {
    flagValue = false;
    const res = await generateCompassRead(await baseInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("flag_off");
  });

  test("matching cache hash returns without a provider", async () => {
    flagValue = true;
    const input = await baseInput();
    await db
      .insert(schema.compassReads)
      .values({
        profileId,
        inputHash: compassInputHash(input),
        headline: "You are closer than you think.",
        body: "Cached body for the test.",
        caveat: "Practice, not a promise.",
        model: "test",
      })
      .onConflictDoUpdate({
        target: schema.compassReads.profileId,
        set: { inputHash: compassInputHash(input) },
      });

    // No active provider exists in the harness  a cache MISS would fail
    // with no_provider, so an ok result proves the cache path served it.
    const res = await generateCompassRead(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.read.cached).toBe(true);
      expect(res.read.headline).toBe("You are closer than you think.");
    }

    // Changed data → new hash → cache miss → provider gate refuses.
    const changed = { ...input, gaps: [["Kubernetes", 30]] as Array<[string, number]> };
    const miss = await generateCompassRead(changed);
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(["no_provider", "throttled"]).toContain(miss.reason);
  });

  test("moderation backstop flags promises, URLs, contact details", () => {
    expect(narrativeViolations("We guarantee you will get hired.")).toContain("promise");
    expect(narrativeViolations("Visit https://example.com now")).toContain("url");
    expect(narrativeViolations("Call 0821234567890 today")).toContain("contact");
    expect(
      narrativeViolations(
        "Learning Docker would strengthen your profile. Practice, not a promise.",
      ),
    ).toHaveLength(0);
  });
});
