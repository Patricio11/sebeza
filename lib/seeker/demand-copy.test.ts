import { describe, expect, test } from "vitest";
import { demandDetail } from "./demand-copy";

describe("demandDetail", () => {
  test("many searches, many holders", () => {
    expect(demandDetail(14, 12)).toBe(
      "14 searches in the last 90 days mention this skill, and only 12 people on Sebenza have it.",
    );
  });

  test("a single search agrees with its verb", () => {
    expect(demandDetail(1, 5)).toBe(
      "1 search in the last 90 days mentions this skill, and only 5 people on Sebenza have it.",
    );
  });

  test("one holder is a person, not people", () => {
    expect(demandDetail(9, 1)).toContain("only 1 person on Sebenza has it");
  });

  test("zero holders reads as a sentence, not as a count of nobody", () => {
    const line = demandDetail(14, 0);
    expect(line).toContain("nobody on Sebenza has it yet");
    expect(line).not.toContain("0 people");
  });

  test("never says people carries", () => {
    for (const matches of [0, 1, 2, 40]) {
      expect(demandDetail(3, matches)).not.toMatch(/people .*carries/);
    }
  });
});
