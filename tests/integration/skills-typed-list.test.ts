/**
 * A real seeker's skill list: 3 catalogue picks + 19 typed entries (the
 * founder's own, 2026-08-28). It must save, typed entries that match a
 * catalogue skill must attach, the rest must reach the review queue exactly
 * once even though autosave calls updateSkills repeatedly, and a bad entry
 * must be named in the error.
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

const db = getDb();
const PROFILE = "prof_lerato-n";

const TYPED = [
  "Full-Stack Web Development",
  "JavaScript",
  "Node.js & Express.js",
  "PHP & Laravel",
  "MySQL",
  "MongoDB",
  "REST APIs",
  "API Integration",
  "Software Architecture",
  "Database Design",
  "Version control",
  "Git & GitLab",
  "Docker",
  "CI/CD Pipelines",
  "Unit Testing",
  "Agile & Scrum",
  "Technical Leadership",
  "Cloud Deployment",
  "System Design",
];
const LIST = [
  { slug: "typescript", proficiency: 2, yearsOfExperience: null },
  { slug: "python", proficiency: 3, yearsOfExperience: null },
  { slug: "postgres", proficiency: 4, yearsOfExperience: null },
  ...TYPED.map((t) => ({ slug: t, proficiency: 4, yearsOfExperience: null })),
];

type SkillRow = typeof schema.profileSkills.$inferSelect;
let snapshot: SkillRow[] = [];

async function pendingCount(): Promise<number> {
  const rows = await db
    .select({ id: schema.taxonomySuggestions.id })
    .from(schema.taxonomySuggestions)
    .where(
      and(
        eq(schema.taxonomySuggestions.submittedByUserId, SEEKER.id),
        eq(schema.taxonomySuggestions.kind, "skill"),
        eq(schema.taxonomySuggestions.state, "pending"),
      ),
    );
  return rows.length;
}

async function cleanupSuggestions() {
  await db
    .delete(schema.taxonomySuggestions)
    .where(
      and(
        eq(schema.taxonomySuggestions.submittedByUserId, SEEKER.id),
        eq(schema.taxonomySuggestions.kind, "skill"),
      ),
    );
}

beforeAll(async () => {
  snapshot = await db
    .select()
    .from(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
  await cleanupSuggestions();
});

afterAll(async () => {
  await cleanupSuggestions();
  await db
    .delete(schema.profileSkills)
    .where(eq(schema.profileSkills.profileId, PROFILE));
  if (snapshot.length > 0)
    await db.insert(schema.profileSkills).values(snapshot);
});

describe("a realistic typed skill list", () => {
  test("saves; catalogue matches attach; the rest queue exactly once across repeated autosaves", async () => {
    expect(LIST.length).toBe(22);
    const first = await updateSkills({ skills: LIST });
    expect(first.ok).toBe(true);

    const rows = await db
      .select({ slug: schema.profileSkills.skillSlug })
      .from(schema.profileSkills)
      .where(eq(schema.profileSkills.profileId, PROFILE));
    const slugs = new Set(rows.map((r) => r.slug));
    expect(slugs.has("typescript")).toBe(true);
    expect(slugs.has("python")).toBe(true);
    expect(slugs.has("postgres")).toBe(true);
    // "Node.js & Express.js" normalises onto the catalogue's Node.js.
    expect(slugs.has("node")).toBe(true);

    const queued = await pendingCount();
    expect(queued).toBeGreaterThan(0);
    expect(queued + rows.length).toBeGreaterThanOrEqual(19);

    // Autosave fires again with the same list: nothing new may be queued.
    const second = await updateSkills({ skills: LIST });
    expect(second.ok).toBe(true);
    expect(await pendingCount()).toBe(queued);
  });

  test("an invalid entry is named, not the whole list", async () => {
    const res = await updateSkills({
      skills: [
        { slug: "typescript", proficiency: 3, yearsOfExperience: null },
        { slug: "MongoDB", proficiency: 9, yearsOfExperience: null },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain("MongoDB");
      expect(res.message).toContain("1 and 5");
    }
  });
});
