/**
 * Phase 20 (20.0)  the cycle guard for the skill-prerequisite write path.
 * A prerequisite graph must stay acyclic or the compass re-ranking could
 * deadlock; `wouldCreateCycle` is the structural defence.
 */
import { describe, expect, test } from "vitest";
import {
  wouldCreateCycle,
  applyPrereqOrdering,
  type PrereqEdge,
} from "./prereq-graph";

const edges: PrereqEdge[] = [
  { skillSlug: "postgres", prereqSkillSlug: "sql" },
  { skillSlug: "kubernetes", prereqSkillSlug: "docker" },
  { skillSlug: "docker", prereqSkillSlug: "linux" },
];

describe("wouldCreateCycle", () => {
  test("self-loop is always a cycle", () => {
    expect(wouldCreateCycle(edges, "sql", "sql")).toBe(true);
  });

  test("a fresh, unrelated edge is fine", () => {
    expect(wouldCreateCycle(edges, "spark", "python")).toBe(false);
  });

  test("a direct back-edge is a cycle (sql requires postgres, but postgres requires sql)", () => {
    expect(wouldCreateCycle(edges, "sql", "postgres")).toBe(true);
  });

  test("a transitive back-edge is a cycle (linux requires kubernetes → docker → linux)", () => {
    expect(wouldCreateCycle(edges, "linux", "kubernetes")).toBe(true);
  });

  test("extending the chain forward is allowed (linux requires bash)", () => {
    expect(wouldCreateCycle(edges, "linux", "bash")).toBe(false);
  });
});

describe("applyPrereqOrdering", () => {
  const labels = new Map([
    ["sql", "SQL"],
    ["postgres", "Postgres"],
    ["docker", "Docker"],
  ]);
  const rec = (slug: string) => ({ skill: { slug }, detail: slug });

  test("a recommended prereq bubbles above its dependent", () => {
    const recs = [rec("postgres"), rec("sql"), rec("docker")];
    const edges: PrereqEdge[] = [
      { skillSlug: "postgres", prereqSkillSlug: "sql" },
    ];
    const out = applyPrereqOrdering(recs, edges, new Set(), labels);
    const order = out.map((r) => r.skill.slug);
    expect(order.indexOf("sql")).toBeLessThan(order.indexOf("postgres"));
  });

  test("annotates unmet prereqs with labels; met prereqs drop off", () => {
    const recs = [rec("postgres")];
    const edges: PrereqEdge[] = [
      { skillSlug: "postgres", prereqSkillSlug: "sql" },
    ];
    const unmet = applyPrereqOrdering(recs, edges, new Set(), labels);
    expect(unmet[0]!.unmetPrereqs).toEqual(["SQL"]);
    const met = applyPrereqOrdering(recs, edges, new Set(["sql"]), labels);
    expect(met[0]!.unmetPrereqs).toEqual([]);
  });

  test("order is otherwise stable (no prereqs → original order)", () => {
    const recs = [rec("docker"), rec("postgres"), rec("sql")];
    const out = applyPrereqOrdering(recs, [], new Set(), labels);
    expect(out.map((r) => r.skill.slug)).toEqual(["docker", "postgres", "sql"]);
  });
});
