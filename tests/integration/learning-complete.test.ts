/**
 * The learning loop's last step: "Mark complete" lands the skill on the
 * profile. It 500'd since Phase 9.12 because profile_skills had no unique
 * index for the ON CONFLICT upsert (migration 0079 adds it + dedupes).
 * Runs as Lerato (seeded Software Developer, Gauteng).
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";

const SEEKER = {
  id: "user_lerato-n",
  role: "seeker" as const,
  email: "lerato-n@example.co.za",
};

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return { ...original, verifyRole: vi.fn(async () => SEEKER) };
});
vi.mock("@/lib/auth/guard", () => ({
  getSessionUser: vi.fn(async () => SEEKER),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  acceptRecommendation,
  completeLearningItem,
  startLearningItem,
} from "@/lib/seeker/learning";

const db = getDb();
const PROFILE = "prof_lerato-n";
const TEST_SKILLS = ["customer-service", "react"];

type SkillRow = typeof schema.profileSkills.$inferSelect;
let snapshot: SkillRow[] = [];

function unwrap<T>(r: unknown): T[] {
  return Array.isArray(r) ? (r as T[]) : ((r as { rows: T[] }).rows ?? []);
}

async function skillRows(slug: string) {
  return db
    .select()
    .from(schema.profileSkills)
    .where(
      and(
        eq(schema.profileSkills.profileId, PROFILE),
        eq(schema.profileSkills.skillSlug, slug),
      ),
    );
}

async function acceptStart(slug: string): Promise<string> {
  const acc = await acceptRecommendation({ skillSlug: slug });
  if (!acc.ok) throw new Error(acc.message);
  const started = await startLearningItem(acc.itemId);
  if (!started.ok) throw new Error(started.message);
  return acc.itemId;
}

beforeAll(async () => {
  snapshot = await db
    .select()
    .from(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
});

afterAll(async () => {
  await db
    .delete(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.profileId, PROFILE),
        inArray(schema.learningItems.skillSlug, TEST_SKILLS),
      ),
    );
  await db
    .delete(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
  if (snapshot.length > 0)
    await db.insert(schema.profileSkills).values(snapshot);
});

describe("learning loop completion", () => {
  test("profile_skills carries the unique (profile, skill) index and no duplicates", async () => {
    const idx = unwrap<{ indexname: string }>(
      await db.execute(
        sql`SELECT indexname FROM pg_indexes WHERE tablename = 'profile_skills' AND indexname = 'profile_skills_profile_skill_uniq'`,
      ),
    );
    expect(idx.length).toBe(1);
    const dupes = unwrap<{ n: number }>(
      await db.execute(
        sql`SELECT COUNT(*)::int AS n FROM (SELECT profile_id, skill_slug FROM profile_skills GROUP BY 1, 2 HAVING COUNT(*) > 1) d`,
      ),
    );
    expect(dupes[0]?.n).toBe(0);
  });

  test("completing a new skill lands it on the profile as self-attested via learning", async () => {
    expect((await skillRows("customer-service")).length).toBe(0);
    const itemId = await acceptStart("customer-service");
    const res = await completeLearningItem(itemId);
    expect(res.ok).toBe(true);
    const rows = await skillRows("customer-service");
    expect(rows.length).toBe(1);
    expect(rows[0]?.provenance).toBe("self_attested_learning");
  });

  test("completing a skill already on the profile upgrades provenance without a duplicate row", async () => {
    const before = await skillRows("react");
    expect(before.length).toBe(1);
    expect(before[0]?.provenance).toBe("self_attested");
    const itemId = await acceptStart("react");
    const res = await completeLearningItem(itemId);
    expect(res.ok).toBe(true);
    const after = await skillRows("react");
    expect(after.length).toBe(1);
    expect(after[0]?.provenance).toBe("self_attested_learning");
    expect(after[0]?.proficiency).toBe(before[0]?.proficiency);
  });
});
