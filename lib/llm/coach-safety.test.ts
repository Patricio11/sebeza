/**
 * Phase 22 — AI Coach safety helpers.
 *
 * These are the deterministic parts of the wellbeing layer, so they get real
 * unit coverage: the output-moderation backstop (22.3), the distress screen
 * (22.2), and a drift-guard on the hardened system prompt (22.1).
 */
import { describe, expect, test } from "vitest";
import { moderateQuestions, detectDistress } from "./coach-safety";
import { coachSystemPrompt } from "./seeker-coach";

describe("moderateQuestions (22.3 output backstop)", () => {
  test("keeps ordinary interview questions", () => {
    const qs = [
      "Tell me about a time you handled a difficult customer.",
      "How would you debug a slow database query?",
      "Describe a project you're proud of.",
    ];
    const { kept, droppedCount } = moderateQuestions(qs);
    expect(kept).toEqual(qs);
    expect(droppedCount).toBe(0);
  });

  test("drops promises / outcome claims", () => {
    const { kept, droppedCount } = moderateQuestions([
      "Tell me about your strengths.",
      "If you answer well you are hired on the spot.",
      "You passed — when can you start?",
    ]);
    expect(droppedCount).toBe(2);
    expect(kept).toEqual(["Tell me about your strengths."]);
  });

  test("drops contact details (email / url / phone)", () => {
    const { kept, droppedCount } = moderateQuestions([
      "Good question about teamwork.",
      "Email me at recruiter@example.com to continue.",
      "Call 0821234567 for the next round.",
      "See https://example.com for the offer.",
    ]);
    expect(droppedCount).toBe(3);
    expect(kept).toEqual(["Good question about teamwork."]);
  });
});

describe("detectDistress (22.2 crisis screen)", () => {
  test.each([
    "i want to die",
    "I've been thinking about killing myself",
    "there is no point to live anymore",
    "I can't go on",
    "everyone would be better off without me",
    "thinking about suicide",
  ])("flags crisis signal: %s", (text) => {
    expect(detectDistress(text)).toBe(true);
  });

  test.each([
    "Junior software developer",
    "Chef de partie",
    "I want to improve my skills",
    "Sales representative",
    "",
  ])("passes benign role text: %s", (text) => {
    expect(detectDistress(text)).toBe(false);
  });
});

describe("coachSystemPrompt (22.1 drift guard)", () => {
  test("names each refused advice class + the no-promise rule", () => {
    const p = coachSystemPrompt().toLowerCase();
    expect(p).toContain("financial");
    expect(p).toContain("legal");
    expect(p).toContain("medical");
    expect(p).toContain("mental-health");
    expect(p).toContain("never promise");
    expect(p).toContain("refuse");
    // The structured-refusal output contract must survive.
    expect(p).toContain("refusal");
  });
});
