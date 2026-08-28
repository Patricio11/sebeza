/**
 * AI blueprint drafts: approve writes the reviewed rows (minus what the
 * admin unticked), adds the draft's new skills to the taxonomy, replaces
 * the profession's previous rows; reject leaves everything untouched. The
 * model itself is not called here (the parser is unit-tested; the provider
 * path is the shared catalogue-draft transport).
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";

const ADMIN = {
  id: "user_sebenza-admin",
  role: "admin" as const,
  email: "admin@sebenzasa.com",
};

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return { ...original, verifyAdmin: vi.fn(async () => ADMIN) };
});

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  approveBlueprintDraft,
  rejectBlueprintDraft,
} from "@/lib/admin/blueprints";
import { getBlueprintRows } from "@/db/queries/blueprints";

const db = getDb();
const PROFESSION = "drone-pilot-test";

afterAll(async () => {
  await db
    .delete(schema.professionSkillBlueprints)
    .where(eq(schema.professionSkillBlueprints.professionSlug, PROFESSION));
  await db
    .delete(schema.blueprintDrafts)
    .where(eq(schema.blueprintDrafts.professionSlug, PROFESSION));
  await db
    .delete(schema.skills)
    .where(eq(schema.skills.slug, "drone-piloting-test"));
});

describe("blueprint drafts", () => {
  test("approve writes reviewed rows, adds new skills, replaces old rows", async () => {
    // A stale hand-made row that the approved draft must replace.
    await db.insert(schema.professionSkillBlueprints).values({
      professionSlug: PROFESSION,
      skillSlug: "excel",
      tier: "core",
      source: "admin",
    });
    await db.insert(schema.blueprintDrafts).values({
      id: "bd_test_1",
      professionSlug: PROFESSION,
      state: "pending",
      rawModel: "test-model",
      createdByUserId: ADMIN.id,
      payload: {
        core: ["git", "problem-solving", "drone-piloting-test"],
        expected: ["site-safety"],
        tracks: [
          {
            name: "Survey & mapping",
            skills: ["data-analysis", "reading-drawings"],
          },
        ],
        proveIt: { "drone-piloting-test": "Log ten supervised flights." },
        newSkills: [
          {
            slug: "drone-piloting-test",
            label: "Drone piloting (test)",
            category: "technical",
          },
        ],
      },
    });
    const res = await approveBlueprintDraft({
      id: "bd_test_1",
      drop: ["reading-drawings"],
    });
    expect(res.ok).toBe(true);

    const { rows, source } = await getBlueprintRows(PROFESSION);
    expect(source).toBe("db");
    const slugs = rows.map((r) => r.skillSlug).sort();
    expect(slugs).toEqual([
      "data-analysis",
      "drone-piloting-test",
      "git",
      "problem-solving",
      "site-safety",
    ]);
    expect(rows.find((r) => r.skillSlug === "data-analysis")).toMatchObject({
      tier: "next_level",
      track: "Survey & mapping",
    });
    expect(
      rows.find((r) => r.skillSlug === "drone-piloting-test")?.proveIt,
    ).toBe("Log ten supervised flights.");
    const [skill] = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.slug, "drone-piloting-test"));
    expect(skill?.label).toBe("Drone piloting (test)");
    const [draft] = await db
      .select()
      .from(schema.blueprintDrafts)
      .where(eq(schema.blueprintDrafts.id, "bd_test_1"));
    expect(draft?.state).toBe("approved");
  });

  test("a draft cannot be approved twice; reject only flips state", async () => {
    const again = await approveBlueprintDraft({ id: "bd_test_1", drop: [] });
    expect(again.ok).toBe(false);
    await db.insert(schema.blueprintDrafts).values({
      id: "bd_test_2",
      professionSlug: PROFESSION,
      state: "pending",
      createdByUserId: ADMIN.id,
      payload: {
        core: ["git", "sql", "excel"],
        expected: [],
        tracks: [],
        proveIt: {},
        newSkills: [],
      },
    });
    const rej = await rejectBlueprintDraft({ id: "bd_test_2" });
    expect(rej.ok).toBe(true);
    const rows = await db
      .select({ s: schema.professionSkillBlueprints.skillSlug })
      .from(schema.professionSkillBlueprints)
      .where(
        and(
          eq(schema.professionSkillBlueprints.professionSlug, PROFESSION),
          eq(schema.professionSkillBlueprints.skillSlug, "sql"),
        ),
      );
    expect(rows.length).toBe(0);
  });
});
