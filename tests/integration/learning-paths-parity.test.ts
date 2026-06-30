/**
 * Phase 18 (18.0)  behaviour-preserving migration parity.
 *
 * The learning-path catalog moved from the `MOCK_COMPASS.learningPaths` constant
 * into the `learning_paths` table. This proves the seed mirrors the constant
 * EXACTLY  same set, same order, same fields  so the compass + abandon-modal
 * render identically post-migration (the whole point of a behaviour-preserving
 * move). If anyone adds a DB path or edits the constant without the other, this
 * catches the drift.
 */
import { describe, expect, test } from "vitest";
import { listAllLearningPaths } from "@/db/queries/learning-paths";
import { MOCK_COMPASS } from "@/lib/mock/growth";

describe("learning_paths seed mirrors MOCK_COMPASS.learningPaths", () => {
  test("DB catalog equals the constant (same order + every field)", async () => {
    const fromDb = await listAllLearningPaths();
    const expected = MOCK_COMPASS.learningPaths;

    expect(fromDb.length).toBe(expected.length);
    fromDb.forEach((p, i) => {
      const e = expected[i]!;
      expect(p.title, `path ${i} title`).toBe(e.title);
      expect(p.provider, `path ${i} provider`).toBe(e.provider);
      expect(p.providerKind, `path ${i} providerKind`).toBe(e.providerKind);
      expect(p.cost, `path ${i} cost`).toBe(e.cost);
      expect(p.costNote ?? undefined, `path ${i} costNote`).toBe(
        e.costNote ?? undefined,
      );
      expect(p.outcome, `path ${i} outcome`).toBe(e.outcome);
      expect(p.durationWeeks, `path ${i} durationWeeks`).toBe(e.durationWeeks);
      expect(p.unlocksSkills, `path ${i} unlocksSkills`).toEqual(
        e.unlocksSkills,
      );
      expect(p.national ?? false, `path ${i} national`).toBe(
        e.national ?? false,
      );
      expect(p.url ?? undefined, `path ${i} url`).toBe(e.url ?? undefined);
      expect(p.sebenzaReviewed ?? false, `path ${i} sebenzaReviewed`).toBe(
        e.sebenzaReviewed ?? false,
      );
    });
  });
});
