/**
 * Phase 12 (Task 12.1)  free-alternative lookup fixtures (Phase 11.2.2).
 * Phase 18: the catalog source moved to the `learning_paths` table, but the
 * ordering contract is unchanged and still lives in the PURE `pickFreeAlternative`
 * (the async `findFreeAlternativeForSkill` just feeds it the DB catalog). We unit-
 * test the pure picker against `MOCK_COMPASS.learningPaths` — the exact catalog
 * the seed mirrors into the table, so this stays a fast, DB-free unit test AND
 * proves the seeded behaviour (the integration parity test proves the seed === here).
 *
 * The ordering rules are codified in the module header: free beats subsidised,
 * national beats metro-only, shorter beats longer. Rather than hand-pick
 * catalogue entries (brittle against editorial changes), the main fixture
 * re-derives the expected winner for EVERY skill in the taxonomy with an
 * independent implementation of the documented rules and compares.
 */

import { describe, expect, test } from "vitest";
import { MOCK_COMPASS } from "@/lib/mock/growth";
import { SKILLS } from "@/lib/mock/taxonomy";
import { pickFreeAlternative } from "./free-alternatives";

const CATALOG = MOCK_COMPASS.learningPaths;

/** Independent re-derivation of the documented contract. */
function expectedWinner(skillSlug: string, excludeTitles: string[] = []) {
  const skill = SKILLS.find((s) => s.slug === skillSlug);
  if (!skill) return null;
  const label = skill.label.toLowerCase();
  const exclude = new Set(excludeTitles);
  const candidates = CATALOG.filter((p) => {
    if (exclude.has(p.title)) return false;
    if (p.cost !== "free" && p.cost !== "subsidised") return false;
    return p.unlocksSkills.some(
      (s) =>
        s.toLowerCase() === label ||
        s.toLowerCase().includes(label) ||
        label.includes(s.toLowerCase()),
    );
  });
  if (candidates.length === 0) return null;
  const rank = (p: (typeof candidates)[number]) =>
    [p.cost === "free" ? 0 : 1, p.national ? 0 : 1, p.durationWeeks] as const;
  candidates.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < 3; i++) {
      if (ra[i]! !== rb[i]!) return ra[i]! - rb[i]!;
    }
    return 0;
  });
  return candidates[0]!.title;
}

describe("pickFreeAlternative", () => {
  test("unknown skill slug → null (never a fake recommendation)", () => {
    expect(pickFreeAlternative(CATALOG, "not-a-real-skill")).toBeNull();
  });

  test("matches the documented ordering for every skill in the taxonomy", () => {
    for (const { slug } of SKILLS) {
      const actual = pickFreeAlternative(CATALOG, slug);
      const expected = expectedWinner(slug);
      expect(actual?.title ?? null, `skill: ${slug}`).toBe(expected);
    }
  });

  test("only ever recommends free or subsidised paths", () => {
    for (const { slug } of SKILLS) {
      const alt = pickFreeAlternative(CATALOG, slug);
      if (alt) expect(["free", "subsidised"]).toContain(alt.cost);
    }
  });

  test("excludeTitles removes the abandoned path from consideration", () => {
    // Find any skill that has at least one alternative, exclude the winner,
    // and assert it can never be recommended again.
    const withAlt = SKILLS.map((s) => s.slug).find(
      (slug) => pickFreeAlternative(CATALOG, slug) !== null,
    );
    expect(withAlt, "catalogue should yield at least one alternative").toBeDefined();
    const first = pickFreeAlternative(CATALOG, withAlt!)!;
    const second = pickFreeAlternative(CATALOG, withAlt!, [first.title]);
    expect(second?.title).not.toBe(first.title);
    expect(second?.title ?? null).toBe(expectedWinner(withAlt!, [first.title]));
  });
});
