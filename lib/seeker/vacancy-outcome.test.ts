/**
 * Phase 12 (Task 12.1)  vacancy-outcome composer fixtures.
 *
 * Pins the Phase 9.11 D4 privacy invariant and the composer's observable
 * contract. The invariant is structural  `OutcomeComposerInput` has NO
 * field for the hired person, so the body *cannot* name them  but the
 * anonymous wording ("hired someone else") and the requirements-vs-recipient
 * framing are behaviour these fixtures keep honest:
 *
 *   - title attributes the org + vacancy, anonymises the hire
 *   - missing-skill list caps at 5 and feeds the Career Compass deep link
 *   - matched-every-skill recipients get the "other factors" message,
 *     never a fabricated gap
 *   - dominant decline-reason line appears only when the k-floored value
 *     is provided
 */

import { describe, expect, test } from "vitest";
import { SKILLS } from "@/lib/mock/taxonomy";
import { composeOutcomeNotification } from "./vacancy-outcome";

const slugs = SKILLS.map((s) => s.slug);

function baseInput(over: Partial<Parameters<typeof composeOutcomeNotification>[0]> = {}) {
  return {
    orgName: "Discovery Bank",
    vacancyTitle: "Senior Backend Engineer",
    professionLabel: "Software Developer",
    requiredSkillSlugs: slugs.slice(0, 3),
    seniorityLabel: "Senior",
    recipientSkillSlugs: slugs.slice(0, 1),
    recipientYearsExperience: 4,
    dominantDeclineReason: null,
    ...over,
  };
}

describe("anonymity + attribution", () => {
  test("title names the org and role but the hire stays anonymous", () => {
    const { title } = composeOutcomeNotification(baseInput());
    expect(title).toBe(
      'Discovery Bank hired someone else for "Senior Backend Engineer"',
    );
  });

  test("input shape has no hired-person field (structural D4 pin)", () => {
    // If a future refactor adds hired-person data to the composer input,
    // this fixture forces the author to confront the D4 invariant.
    expect(Object.keys(baseInput()).sort()).toEqual(
      [
        "dominantDeclineReason",
        "orgName",
        "professionLabel",
        "recipientSkillSlugs",
        "recipientYearsExperience",
        "requiredSkillSlugs",
        "seniorityLabel",
        "vacancyTitle",
      ].sort(),
    );
  });
});

describe("gap analysis", () => {
  test("missing skills = required minus recipient, capped at 5", () => {
    const required = slugs.slice(0, 8); // 8 required
    const recipient = slugs.slice(0, 1); // has 1 of them → 7 missing
    const out = composeOutcomeNotification(
      baseInput({ requiredSkillSlugs: required, recipientSkillSlugs: recipient }),
    );
    expect(out.missingSkillSlugs).toHaveLength(5);
    for (const slug of out.missingSkillSlugs) {
      expect(required).toContain(slug);
      expect(recipient).not.toContain(slug);
    }
  });

  test("deep link carries the missing slugs for Career Compass pre-highlight", () => {
    const out = composeOutcomeNotification(baseInput());
    expect(out.link).toBe(
      `/dashboard/grow?missing=${out.missingSkillSlugs.join(",")}`,
    );
  });

  test("full-match recipient: no gap is fabricated, link is plain Compass", () => {
    const required = slugs.slice(0, 3);
    const out = composeOutcomeNotification(
      baseInput({
        requiredSkillSlugs: required,
        recipientSkillSlugs: [...required, ...slugs.slice(3, 5)],
      }),
    );
    expect(out.missingSkillSlugs).toEqual([]);
    expect(out.link).toBe("/dashboard/grow");
    expect(out.body).toContain("every skill the role asked for");
  });

  test("no required skills + no seniority: body still composes with closure + Compass nudge", () => {
    const out = composeOutcomeNotification(
      baseInput({ requiredSkillSlugs: [], seniorityLabel: null }),
    );
    expect(out.body.length).toBeGreaterThan(0);
    expect(out.body).toContain("Career Compass");
    expect(out.missingSkillSlugs).toEqual([]);
  });
});

describe("decline-reason context (k-floored upstream)", () => {
  test("absent when null (cell below k or no data)", () => {
    const out = composeOutcomeNotification(
      baseInput({ dominantDeclineReason: null }),
    );
    expect(out.body).not.toContain("most common reason");
  });

  test("present when a dominant reason is provided", () => {
    const out = composeOutcomeNotification(
      baseInput({ dominantDeclineReason: "salary_not_competitive" }),
    );
    expect(out.body).toContain("most common reason");
    expect(out.body).toContain("Software Developer");
  });
});
