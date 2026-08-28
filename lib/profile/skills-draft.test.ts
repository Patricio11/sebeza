import { describe, expect, test } from "vitest";

import { serialiseSkills, skillsDirty } from "./skills-draft";

const a = { slug: "react", proficiency: 3, yearsOfExperience: null };
const b = { slug: "sql", proficiency: 4, yearsOfExperience: 2 };

describe("skills draft fingerprint", () => {
  test("order and labels do not matter", () => {
    expect(serialiseSkills([a, b])).toBe(serialiseSkills([b, a]));
    expect(serialiseSkills([{ ...a, label: "React" } as typeof a])).toBe(
      serialiseSkills([a]),
    );
  });

  test("proficiency, years, and membership do matter", () => {
    const saved = serialiseSkills([a, b]);
    expect(skillsDirty([a, b], saved)).toBe(false);
    expect(skillsDirty([{ ...a, proficiency: 4 }, b], saved)).toBe(true);
    expect(skillsDirty([a, { ...b, yearsOfExperience: 3 }], saved)).toBe(true);
    expect(skillsDirty([a], saved)).toBe(true);
    expect(
      skillsDirty(
        [a, b, { slug: "docker", proficiency: 3, yearsOfExperience: null }],
        saved,
      ),
    ).toBe(true);
  });

  test("undefined years equals null years", () => {
    expect(
      skillsDirty(
        [
          {
            slug: "react",
            proficiency: 3,
            yearsOfExperience: undefined as unknown as null,
          },
        ],
        serialiseSkills([a]),
      ),
    ).toBe(false);
  });
});
