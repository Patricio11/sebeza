/**
 * Phase 20 ("Skill Prerequisites & Sequencing")  pure graph helpers over the
 * skill prerequisite edges. No I/O  trivially unit-tested. Edge semantics:
 * `skillSlug` is best learned AFTER `prereqSkillSlug` (skill → requires → prereq).
 */

export interface PrereqEdge {
  skillSlug: string;
  prereqSkillSlug: string;
}

/**
 * Would adding `skill → prereq` create a cycle, given the existing edges? True
 * when `prereq` already (transitively) requires `skill` (so requiring `prereq`
 * for `skill` would close a loop), or the trivial self-loop.
 */
export function wouldCreateCycle(
  edges: PrereqEdge[],
  skill: string,
  prereq: string,
): boolean {
  if (skill === prereq) return true;
  const requires = new Map<string, string[]>();
  for (const e of edges) {
    const arr = requires.get(e.skillSlug) ?? [];
    arr.push(e.prereqSkillSlug);
    requires.set(e.skillSlug, arr);
  }
  // Walk the "requires" chain starting at `prereq`; reaching `skill` = cycle.
  const seen = new Set<string>();
  const stack = [prereq];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === skill) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const p of requires.get(node) ?? []) stack.push(p);
  }
  return false;
}

/**
 * Phase 20.1  re-order recommendations so a recommended skill never sits above
 * a recommended unmet prerequisite (a stable topological sort over the subgraph
 * induced by the recommended slugs), and annotate each with `unmetPrereqs` (the
 * labels of its prerequisites the seeker doesn't yet hold). Pure  the demand
 * math upstream is untouched; we only sequence + label what's already there.
 */
export function applyPrereqOrdering<T extends { skill: { slug: string } }>(
  recs: T[],
  edges: PrereqEdge[],
  ownedSlugs: Set<string>,
  labelBySlug: Map<string, string>,
): Array<T & { unmetPrereqs: string[] }> {
  const prereqsBySkill = new Map<string, string[]>();
  for (const e of edges) {
    const arr = prereqsBySkill.get(e.skillSlug) ?? [];
    arr.push(e.prereqSkillSlug);
    prereqsBySkill.set(e.skillSlug, arr);
  }

  const annotated = recs.map((r) => ({
    ...r,
    unmetPrereqs: (prereqsBySkill.get(r.skill.slug) ?? [])
      .filter((p) => !ownedSlugs.has(p))
      .map((p) => labelBySlug.get(p) ?? p),
  }));

  // Stable topological sort over edges where BOTH ends are recommended.
  const recSlugs = new Set(recs.map((r) => r.skill.slug));
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const r of annotated) indeg.set(r.skill.slug, 0);
  for (const e of edges) {
    if (recSlugs.has(e.skillSlug) && recSlugs.has(e.prereqSkillSlug)) {
      indeg.set(e.skillSlug, (indeg.get(e.skillSlug) ?? 0) + 1);
      const d = dependents.get(e.prereqSkillSlug) ?? [];
      d.push(e.skillSlug);
      dependents.set(e.prereqSkillSlug, d);
    }
  }

  const indexBySlug = new Map(annotated.map((r, i) => [r.skill.slug, i]));
  const result: Array<T & { unmetPrereqs: string[] }> = [];
  const placed = new Set<string>();
  while (result.length < annotated.length) {
    // Lowest original index among unplaced indegree-0 nodes (stable tiebreak).
    let pick: string | null = null;
    let pickIdx = Infinity;
    for (const r of annotated) {
      if (placed.has(r.skill.slug)) continue;
      if ((indeg.get(r.skill.slug) ?? 0) === 0) {
        const idx = indexBySlug.get(r.skill.slug)!;
        if (idx < pickIdx) {
          pickIdx = idx;
          pick = r.skill.slug;
        }
      }
    }
    if (pick == null) {
      // Defensive (graph is cycle-guarded): append the rest in original order.
      for (const r of annotated) {
        if (!placed.has(r.skill.slug)) {
          result.push(r);
          placed.add(r.skill.slug);
        }
      }
      break;
    }
    result.push(annotated[indexBySlug.get(pick)!]!);
    placed.add(pick);
    for (const dep of dependents.get(pick) ?? []) {
      indeg.set(dep, (indeg.get(dep) ?? 1) - 1);
    }
  }
  return result;
}
