import { describe, expect, it } from "vitest";
import {
  buildSkillMatcher,
  labelVariants,
  normalizeSkillText,
  SkillMatcher,
} from "./normalize";

const TAXONOMY = [
  { slug: "node", label: "Node.js" },
  { slug: "react", label: "React" },
  { slug: "postgres", label: "PostgreSQL" },
  { slug: "first-aid", label: "First aid" },
  { slug: "typescript", label: "TypeScript" },
  { slug: "customer-service", label: "Customer service" },
];

describe("normalizeSkillText", () => {
  it("collapses punctuation, case and spaces", () => {
    expect(normalizeSkillText("Node.js")).toBe("nodejs");
    expect(normalizeSkillText("NEXT JS")).toBe("nextjs");
    expect(normalizeSkillText("PSIRA Grade A")).toBe("psiragradea");
  });
});

describe("labelVariants", () => {
  it("splits compound labels into their parts", () => {
    expect(labelVariants("Node.js & Express.js")).toEqual(
      expect.arrayContaining(["nodejsexpressjs", "nodejs", "expressjs"]),
    );
  });
  it("keeps single labels whole", () => {
    expect(labelVariants("React")).toEqual(["react"]);
  });
});

describe("SkillMatcher", () => {
  const m = buildSkillMatcher(TAXONOMY);

  it("resolves free-typed variants to canonical slugs", () => {
    expect(m.matchText("nodejs")).toEqual(["node"]);
    expect(m.matchText("node js")).toEqual(["node"]);
    expect(m.matchText("postgresql")).toEqual(["postgres"]);
    // The founder's exact case: a compound custom entry contains a
    // canonical skill.
    expect(m.matchText("Node.js & Express.js")).toEqual(["node"]);
  });

  it("never invents matches", () => {
    expect(m.matchText("php & laravel")).toEqual([]);
    // mysql is NOT sql/postgres; related is not equivalent.
    expect(m.matchText("mysql")).toEqual([]);
  });

  it("expands query text with canonical labels", () => {
    expect(m.expandQueryText("nodejs developer")).toContain("Node.js");
    expect(m.expandQueryText("first aid")).toBe("first aid"); // label already present verbatim
    expect(m.expandQueryText("plumber gauteng")).toBe("plumber gauteng");
  });

  it("expandSlugs always includes the inputs", () => {
    expect(m.expandSlugs(["react"])).toContain("react");
  });

  it("typeahead option matching bridges punctuation", () => {
    expect(SkillMatcher.optionMatches("Node.js", "nodejs")).toBe(true);
    expect(SkillMatcher.optionMatches("PostgreSQL", "postgres")).toBe(true);
    expect(SkillMatcher.optionMatches("React", "vue")).toBe(false);
  });
});
