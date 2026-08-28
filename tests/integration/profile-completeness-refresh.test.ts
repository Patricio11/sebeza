/**
 * Completeness must move the moment anything that feeds it saves: skills,
 * qualifications, experience. It used to update only on the basics form's
 * Save button, which made a seeker jump 36% -> 69% by clicking Save on an
 * untouched form. Runs as Lerato with the session mocked.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";

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
import { updateSkills } from "@/lib/profile/actions";
import {
  addQualification,
  deleteQualification,
} from "@/lib/profile/qualifications";
import { addExperience, deleteExperience } from "@/lib/profile/experience";
import { MAX_PROFILE_SKILLS } from "@/lib/profile/skills-draft";
import { refreshProfileCompleteness } from "@/lib/profile/completeness-internal";

const db = getDb();
const PROFILE = "prof_lerato-n";

type SkillRow = typeof schema.profileSkills.$inferSelect;
let skillsSnapshot: SkillRow[] = [];
let completenessBefore = 0;

async function poison() {
  await db
    .update(schema.profiles)
    .set({ completeness: 1 })
    .where(eq(schema.profiles.id, PROFILE));
}

async function completeness(): Promise<number> {
  const [row] = await db
    .select({ c: schema.profiles.completeness })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, PROFILE));
  return row?.c ?? -1;
}

beforeAll(async () => {
  skillsSnapshot = await db
    .select()
    .from(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
  completenessBefore = await completeness();
});

afterAll(async () => {
  await db
    .delete(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
  if (skillsSnapshot.length > 0)
    await db.insert(schema.profileSkills).values(skillsSnapshot);
  await db
    .update(schema.profiles)
    .set({ completeness: completenessBefore })
    .where(eq(schema.profiles.id, PROFILE));
});

describe("completeness refreshes on every feeding save", () => {
  test("skills: fewer skills lowers it, more skills raises it, both immediately", async () => {
    const two = await updateSkills({
      skills: [
        { slug: "react", proficiency: 4, yearsOfExperience: null },
        { slug: "sql", proficiency: 3, yearsOfExperience: null },
      ],
    });
    expect(two.ok).toBe(true);
    const withTwo = await completeness();

    const five = await updateSkills({
      skills: ["react", "sql", "typescript", "postgres", "node"].map(
        (slug) => ({
          slug,
          proficiency: 3,
          yearsOfExperience: null,
        }),
      ),
    });
    expect(five.ok).toBe(true);
    const withFive = await completeness();
    expect(withFive).toBeGreaterThan(withTwo);
    // Skills weigh 6 points each, capped at 30: five skills = +18 over two.
    expect(withFive - withTwo).toBe(18);
  });

  test("skills: over the cap fails with a readable message, nothing changes", async () => {
    const before = await completeness();
    const res = await updateSkills({
      skills: Array.from({ length: MAX_PROFILE_SKILLS + 1 }, (_, i) => ({
        slug: `made-up-skill-${i}`,
        proficiency: 3,
        yearsOfExperience: null,
      })),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain(String(MAX_PROFILE_SKILLS));
    expect(await completeness()).toBe(before);
  });

  test("qualification add and delete each recompute from the live rows", async () => {
    await poison();
    const added = await addQualification({
      title: "Completeness probe cert",
      institution: "Probe Institute",
      awardedYear: 2024,
    });
    expect(added.ok).toBe(true);
    const afterAdd = await completeness();
    expect(afterAdd).not.toBe(1);
    expect(afterAdd).toBe(await refreshProfileCompleteness(db, PROFILE));
    await poison();
    if (added.ok) {
      const removed = await deleteQualification(added.id);
      expect(removed.ok).toBe(true);
    }
    const afterDelete = await completeness();
    expect(afterDelete).not.toBe(1);
    expect(afterDelete).toBe(await refreshProfileCompleteness(db, PROFILE));
  });

  test("experience add and delete each recompute from the live rows", async () => {
    await poison();
    const added = await addExperience({
      role: "Completeness probe role",
      organization: "Probe Org",
      city: null,
      startedAt: "2023-01",
      endedAt: "2023-06",
      description: null,
    });
    expect(added.ok).toBe(true);
    const afterAdd = await completeness();
    expect(afterAdd).not.toBe(1);
    expect(afterAdd).toBe(await refreshProfileCompleteness(db, PROFILE));
    await poison();
    if (added.ok) {
      const removed = await deleteExperience(added.id);
      expect(removed.ok).toBe(true);
    }
    const afterDelete = await completeness();
    expect(afterDelete).not.toBe(1);
    expect(afterDelete).toBe(await refreshProfileCompleteness(db, PROFILE));
  });
});

// keep `and` referenced for future filters without a lint complaint
void and;
