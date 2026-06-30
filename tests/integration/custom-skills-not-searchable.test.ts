/**
 * Phase 19 (19.0)  the load-bearing invariant: a self-described custom skill
 * must NEVER make a seeker searchable. Unlike `profile_skills` (FK to the
 * taxonomy, joined into the search vector), `profile_skills_custom` is never
 * read by the search path. We prove it behaviourally: attach a distinctive
 * nonsense label to a real seeded profile, then search for that exact label and
 * assert the seeker does not surface.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { searchProfilesQuery } from "@/db/queries/profiles";
import { listCustomSkills } from "@/db/queries/custom-skills";

const db = getDb();
const HANDLE = "andile-z";
const LABEL = "Zzqxraremulchcraft"; // distinctive; appears nowhere else
const ROW_ID = "psc_test_notsearchable";

let profileId = "";

beforeAll(async () => {
  const [p] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, HANDLE))
    .limit(1);
  profileId = p?.id ?? "";
  if (profileId) {
    await db
      .insert(schema.profileSkillsCustom)
      .values({
        id: ROW_ID,
        profileId,
        label: LABEL,
        labelNormalized: LABEL.toLowerCase(),
        proficiency: 4,
      })
      .onConflictDoNothing();
  }
});

afterAll(async () => {
  await db
    .delete(schema.profileSkillsCustom)
    .where(eq(schema.profileSkillsCustom.id, ROW_ID));
});

describe("custom skills are never searchable (Phase 19, D2)", () => {
  test("the custom skill is actually attached to the profile (fixture sanity)", async () => {
    expect(profileId).not.toBe("");
    const list = await listCustomSkills(profileId);
    expect(list.some((s) => s.label === LABEL)).toBe(true);
  });

  test("searching for the custom-skill label does not surface the seeker", async () => {
    const { profiles } = await searchProfilesQuery({ query: LABEL });
    expect(profiles.some((p) => p.handle === HANDLE)).toBe(false);
  });
});
