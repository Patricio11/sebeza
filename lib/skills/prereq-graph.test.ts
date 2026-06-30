/**
 * Phase 20 (20.0)  the cycle guard for the skill-prerequisite write path.
 * A prerequisite graph must stay acyclic or the compass re-ranking could
 * deadlock; `wouldCreateCycle` is the structural defence.
 */
import { describe, expect, test } from "vitest";
import { wouldCreateCycle, type PrereqEdge } from "./prereq-graph";

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
