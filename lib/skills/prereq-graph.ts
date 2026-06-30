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
