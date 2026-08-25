/**
 * Smart skill matching (docs/SKILLS_CATEGORIES_MATCHING_PLAN.md).
 *
 * The properties worth locking down:
 *   - free-text search "nodejs" finds profiles holding canonical
 *     "Node.js" (alias expansion through the taxonomy);
 *   - a typed compound skill ("Node.js & Express.js") canonicalises
 *     onto the taxonomy at save time instead of silently dropping to
 *     the admin queue;
 *   - filters.skillSlugs yields the informational matchedSkillCount
 *     without touching the ordering contract.
 */
import { afterAll, describe, expect, test, vi } from "vitest";

const SEEKER = { id: "user_lerato-n", email: "lerato-n@example.co.za", role: "seeker" };

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => SEEKER),
    verifyRole: vi.fn(async () => SEEKER),
  };
});
vi.mock("next/cache", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/cache")>();
  return {
    ...original,
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
  };
});

import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { searchProfilesQuery } from "@/db/queries/profiles";
import { updateSkills } from "@/lib/profile/actions";

const db = getDb();
const PROFILE = "prof_lerato-n";

async function leratoSkills(): Promise<Array<{ slug: string; proficiency: number }>> {
  const rows = await db
    .select({
      slug: schema.profileSkills.skillSlug,
      proficiency: schema.profileSkills.proficiency,
      years: schema.profileSkills.yearsOfExperience,
    })
    .from(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
  return rows.map((r) => ({ slug: r.slug, proficiency: r.proficiency, years: r.years })) as never;
}

// Snapshot to restore after the save tests (shared seeded DB).
let originalSkills: Awaited<ReturnType<typeof leratoSkills>> = [];

afterAll(async () => {
  if (originalSkills.length > 0) {
    await db.delete(schema.profileSkills).where(eq(schema.profileSkills.profileId, PROFILE));
    await db.insert(schema.profileSkills).values(
      originalSkills.map((s) => ({
        profileId: PROFILE,
        skillSlug: s.slug,
        proficiency: s.proficiency,
        yearsOfExperience: (s as { years?: number | null }).years ?? null,
      })),
    );
  }
  await db
    .delete(schema.taxonomySuggestions)
    .where(
      and(
        eq(schema.taxonomySuggestions.kind, "skill"),
        eq(schema.taxonomySuggestions.customText, "Quantum Basket Weaving"),
      ),
    );
});

describe("alias-expanded search", () => {
  test('"nodejs" finds a profile holding canonical Node.js', async () => {
    const res = await searchProfilesQuery({ query: "nodejs" });
    expect(res.profiles.map((p) => p.handle)).toContain("lerato-n");
  });

  test('"postgresql" reaches the canonical PostgreSQL holders', async () => {
    const res = await searchProfilesQuery({ query: "postgresql" });
    expect(res.profiles.map((p) => p.handle)).toContain("lerato-n");
  });
});

describe("matchedSkillCount (informational)", () => {
  test("counts the vacancy skills a profile holds; ordering contract untouched", async () => {
    const res = await searchProfilesQuery({
      query: "developer",
      skillSlugs: ["node", "typescript", "aws"],
    });
    const lerato = res.profiles.find((p) => p.handle === "lerato-n");
    expect(lerato).toBeDefined();
    // She holds node + typescript, not aws.
    expect(lerato!.matchedSkillCount).toBe(2);
    // No skillSlugs -> the field is 0, never undefined.
    const plain = await searchProfilesQuery({ query: "developer" });
    expect(plain.profiles[0]!.matchedSkillCount).toBe(0);
  });
});

describe("save-time canonicalisation", () => {
  test("a typed compound skill attaches to its canonical part; junk still queues", async () => {
    originalSkills = await leratoSkills();

    const res = await updateSkills({
      skills: [
        { slug: "typescript", proficiency: 4, yearsOfExperience: 3 },
        // Typed free text (the picker's "Other" path emits the raw
        // string as a pseudo-slug): must canonicalise onto "node".
        { slug: "Node.js & Express.js", proficiency: 5, yearsOfExperience: 4 },
        // Genuinely new: must go to the admin queue, not the profile.
        { slug: "Quantum Basket Weaving", proficiency: 2, yearsOfExperience: null },
      ],
    });
    expect(res.ok).toBe(true);

    const now = await leratoSkills();
    const slugs = now.map((s) => s.slug).sort();
    expect(slugs).toEqual(["node", "typescript"]);
    const node = now.find((s) => s.slug === "node")!;
    // The typed proficiency followed the canonicalisation.
    expect(node.proficiency).toBe(5);

    const queued = await db
      .select({ customText: schema.taxonomySuggestions.customText })
      .from(schema.taxonomySuggestions)
      .where(
        and(
          eq(schema.taxonomySuggestions.kind, "skill"),
          eq(schema.taxonomySuggestions.customText, "Quantum Basket Weaving"),
        ),
      );
    expect(queued.length).toBeGreaterThanOrEqual(1);
  });
});
