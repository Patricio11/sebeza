import { describe, expect, test } from "vitest";

import { parseBlueprintDraft } from "@/lib/blueprints/draft-parser";

const known = new Set([
  "git",
  "sql",
  "javascript",
  "problem-solving",
  "docker",
  "aws",
  "react",
]);

describe("parseBlueprintDraft", () => {
  test("accepts fenced JSON, drops unknown slugs, dedupes across tiers", () => {
    const text = [
      "```json",
      JSON.stringify({
        core: ["git", "sql", "javascript", "made-up", "git"],
        expected: ["problem-solving", "sql"],
        tracks: [
          { name: "DevOps & Cloud", skills: ["docker", "aws", "git"] },
          { name: "Thin", skills: ["react"] },
        ],
        proveIt: { docker: "Containerise one project.", nope: "x" },
        newSkills: [],
      }),
      "```",
    ].join("\n");
    const r = parseBlueprintDraft(text, known);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.core).toEqual(["git", "sql", "javascript"]);
    expect(r.payload.expected).toEqual(["problem-solving"]);
    expect(r.payload.tracks).toEqual([
      { name: "DevOps & Cloud", skills: ["docker", "aws"] },
    ]);
    expect(r.payload.proveIt).toEqual({ docker: "Containerise one project." });
  });

  test("lets the draft introduce new skills and keeps only the ones it uses", () => {
    const r = parseBlueprintDraft(
      JSON.stringify({
        core: ["git", "sql", "drone-piloting"],
        expected: [],
        tracks: [],
        newSkills: [
          {
            slug: "drone-piloting",
            label: "Drone piloting",
            category: "technical",
          },
          { slug: "unused-skill", label: "Unused", category: "technical" },
          { slug: "git", label: "Git again", category: "technical" },
        ],
      }),
      known,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.core).toContain("drone-piloting");
    expect(r.payload.newSkills).toEqual([
      {
        slug: "drone-piloting",
        label: "Drone piloting",
        category: "technical",
      },
    ]);
  });

  test("refuses a thin core, bad JSON, and the wrong shape", () => {
    expect(
      parseBlueprintDraft(
        JSON.stringify({ core: ["git", "nope"], expected: [] }),
        known,
      ).ok,
    ).toBe(false);
    expect(parseBlueprintDraft("not json", known).ok).toBe(false);
    expect(parseBlueprintDraft(JSON.stringify({ hello: 1 }), known).ok).toBe(
      false,
    );
  });

  test("rejects slugs that are not kebab-case", () => {
    const r = parseBlueprintDraft(
      JSON.stringify({ core: ["git", "sql", "Java Script"], expected: [] }),
      known,
    );
    expect(r.ok).toBe(false);
  });
});
