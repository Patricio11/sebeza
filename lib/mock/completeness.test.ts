/**
 * Completeness formula pins (docs/PROFILE_LANGUAGES_PLAN.md).
 *
 * The stored completeness feeds search ranking, so the formula's terms
 * are contracts: this suite pins the languages term added for the
 * profile-languages feature (+3 each, capped at +6) and the overall
 * cap, so a future rebalance is a deliberate edit here, never a drift.
 */
import { describe, expect, test } from "vitest";
import { computeCompleteness } from "./helpers";
import type { LanguageRef } from "./types";

const lang = (slug: string): LanguageRef => ({
  slug,
  label: slug,
  spoken: "fluent",
  written: "intermediate",
});

const base = {
  city: "",
  bio: "",
  topSkills: [],
  experience: [],
  qualifications: [],
} as const;

describe("computeCompleteness - languages term", () => {
  test("+3 per language, capped at +6", () => {
    expect(computeCompleteness({ ...base })).toBe(0);
    expect(computeCompleteness({ ...base, languages: [lang("a")] })).toBe(3);
    expect(
      computeCompleteness({ ...base, languages: [lang("a"), lang("b")] }),
    ).toBe(6);
    expect(
      computeCompleteness({
        ...base,
        languages: [lang("a"), lang("b"), lang("c")],
      }),
    ).toBe(6);
  });

  test("absent languages field (older payloads) contributes 0", () => {
    expect(computeCompleteness(base)).toBe(0);
  });

  test("overall score still caps at 100 with everything maxed", () => {
    expect(
      computeCompleteness({
        city: "Johannesburg",
        bio: "b".repeat(50),
        topSkills: Array.from({ length: 6 }, (_, i) => ({
          name: `s${i}`,
          proficiency: 3 as const,
        })),
        experience: Array.from({ length: 3 }, () => ({
          role: "",
          organization: "",
          city: "",
          startedAt: "",
          endedAt: null,
        })),
        qualifications: Array.from({ length: 2 }, () => ({
          title: "",
          institution: "",
          awardedYear: null,
          verification: "unverified" as const,
        })),
        languages: [lang("a"), lang("b")],
      }),
    ).toBe(100);
  });
});
