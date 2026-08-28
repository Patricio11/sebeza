import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { PROFESSIONS, SKILLS } from "@/lib/mock/taxonomy";
import {
  NEW_SKILLS,
  STARTER_BLUEPRINTS,
  starterBlueprintFor,
} from "./catalogue";
import { buildRouteMap, rankBlueprintGaps } from "./engine";

const known = new Set([
  ...SKILLS.map((s) => s.slug),
  ...NEW_SKILLS.map((s) => s.slug),
]);

describe("starter blueprints", () => {
  test("every profession in the taxonomy has a blueprint with at least 3 core skills", () => {
    const missing = PROFESSIONS.filter(
      (p) =>
        starterBlueprintFor(p.slug).filter((r) => r.tier === "core").length < 3,
    ).map((p) => p.slug);
    expect(missing).toEqual([]);
  });

  test("every blueprint skill exists in the taxonomy (constant + additions)", () => {
    const unknown = [
      ...new Set(STARTER_BLUEPRINTS.map((r) => r.skillSlug)),
    ].filter((s) => !known.has(s));
    expect(unknown).toEqual([]);
  });

  test("no skill sits in two tiers of the same profession", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const r of STARTER_BLUEPRINTS) {
      const k = `${r.professionSlug}:${r.skillSlug}`;
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes).toEqual([]);
  });

  test("every next-level skill carries a track; core and expected never do", () => {
    expect(
      STARTER_BLUEPRINTS.filter((r) => r.tier === "next_level" && !r.track),
    ).toEqual([]);
    expect(
      STARTER_BLUEPRINTS.filter((r) => r.tier !== "next_level" && r.track),
    ).toEqual([]);
  });

  test("new skills are unique and the SKILLS constant carries every one of them", () => {
    const constant = new Set(SKILLS.map((s) => s.slug));
    const slugs = NEW_SKILLS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.filter((s) => !constant.has(s))).toEqual([]);
    expect(new Set(SKILLS.map((s) => s.slug)).size).toBe(SKILLS.length);
  });

  test("migration 0080 inserts every new skill", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "db/migrations/0080_role_blueprints.sql"),
      "utf8",
    );
    const absent = NEW_SKILLS.filter((s) => !sql.includes(`('${s.slug}', `));
    expect(absent.map((s) => s.slug)).toEqual([]);
  });
});

describe("gap engine", () => {
  const rows = starterBlueprintFor("software-developer");
  const labelBySlug = new Map(
    [...SKILLS, ...NEW_SKILLS].map((s) => [s.slug, s.label]),
  );

  test("a covered core reports zero core gaps and ranks next-level by local demand", () => {
    const owned = new Set([
      "git",
      "javascript",
      "sql",
      "problem-solving",
      "rest-apis",
      "testing",
      "html-css",
      "agile",
      "react",
    ]);
    const demand = new Map([
      ["docker", { searches: 5, matches: 0 }],
      ["aws", { searches: 2, matches: 1 }],
    ]);
    const map = buildRouteMap({
      rows,
      ownedSlugs: owned,
      labelBySlug,
      demandBySlug: demand,
      professionLabel: "Software Developer",
    });
    expect(map.coreCovered).toBe(map.core.length);
    expect(map.tracks[0]?.name).toBe("DevOps & Cloud");
    const gaps = rankBlueprintGaps({
      rows,
      ownedSlugs: owned,
      labelBySlug,
      demandBySlug: demand,
      professionLabel: "Software Developer",
    });
    expect(gaps[0]).toMatchObject({
      slug: "docker",
      reason: "role_next_level",
      track: "DevOps & Cloud",
    });
    expect(gaps[0]?.detail).toContain("5 employer searches");
    expect(gaps.every((g) => g.tier === "next_level")).toBe(true);
  });

  test("missing core skills come first, whatever the demand says", () => {
    const owned = new Set(["react", "docker", "aws"]);
    const demand = new Map([["docker", { searches: 50, matches: 0 }]]);
    const gaps = rankBlueprintGaps({
      rows,
      ownedSlugs: owned,
      labelBySlug,
      demandBySlug: demand,
      professionLabel: "Software Developer",
    });
    expect(gaps[0]?.reason).toBe("role_core");
    expect(gaps.slice(0, 4).every((g) => g.reason === "role_core")).toBe(true);
  });

  test("a started track is mentioned honestly", () => {
    const owned = new Set([
      "git",
      "javascript",
      "sql",
      "problem-solving",
      "rest-apis",
      "testing",
      "html-css",
      "agile",
      "docker",
    ]);
    const gaps = rankBlueprintGaps({
      rows,
      ownedSlugs: owned,
      labelBySlug,
      professionLabel: "Software Developer",
    });
    const devops = gaps.find((g) => g.track === "DevOps & Cloud");
    expect(devops?.detail).toContain("You already hold 1 of 5");
  });
});
