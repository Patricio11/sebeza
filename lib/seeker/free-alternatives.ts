/**
 * Phase 11.2.2  free-alternative lookup.
 * Phase 18 ("Living Learning Catalog")  the catalog source moved from the
 * `MOCK_COMPASS.learningPaths` constant to the `learning_paths` table. The
 * matching logic is unchanged + kept PURE (`pickFreeAlternative` over a passed
 * catalog, so it stays a fast unit test); `findFreeAlternativeForSkill` is the
 * async wrapper that loads the catalog from the DB.
 *
 * Returns the best free/subsidised path that unlocks the requested skill.
 *
 * Ordering rules (codified, not heuristic):
 *   1. Prefer `cost === "free"` over `cost === "subsidised"`.
 *   2. Prefer `national === true` (works for seekers outside major metros).
 *   3. Prefer shorter durationWeeks (lower commitment ask).
 *
 * Excludes any path the caller passes in `excludeTitles`  used by the modal to
 * avoid recommending the same path the seeker just abandoned (or any prior path
 * they bailed on for the same skill).
 *
 * Returns null when nothing matches; the caller falls back to the default
 * abandon flow without surfacing a fake recommendation.
 */

import { type LearningPath } from "@/lib/mock/growth";
import { listAllLearningPaths } from "@/db/queries/learning-paths";
import { SKILLS } from "@/lib/mock/taxonomy";

export interface FreeAlternative {
  title: string;
  provider: string;
  providerKind: LearningPath["providerKind"];
  durationWeeks: number;
  cost: "free" | "subsidised";
  costNote?: string;
  outcome: string;
  url?: string;
  sebenzaReviewed?: boolean;
}

const COST_PRIORITY: Record<"free" | "subsidised", number> = {
  free: 0,
  subsidised: 1,
};

/**
 * Pure picker over a supplied catalog  the codified ordering, no I/O. Unit-
 * tested directly against any catalog (the seed mirrors the old constant).
 */
export function pickFreeAlternative(
  catalog: LearningPath[],
  skillSlug: string,
  excludeTitles: string[] = [],
): FreeAlternative | null {
  const skill = SKILLS.find((s) => s.slug === skillSlug);
  if (!skill) return null;
  const skillLabel = skill.label.toLowerCase();
  const excludeSet = new Set(excludeTitles);

  const candidates = catalog.filter((p) => {
    if (excludeSet.has(p.title)) return false;
    if (p.cost !== "free" && p.cost !== "subsidised") return false;
    // Skill match by label: path.unlocksSkills are free-text labels, not
    // slugs, so we compare case-insensitively + substring-tolerantly
    // (e.g. "Kubernetes basics" satisfies the "Kubernetes" skill).
    return p.unlocksSkills.some(
      (s) =>
        s.toLowerCase() === skillLabel ||
        s.toLowerCase().includes(skillLabel) ||
        skillLabel.includes(s.toLowerCase()),
    );
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aCost = COST_PRIORITY[a.cost as "free" | "subsidised"];
    const bCost = COST_PRIORITY[b.cost as "free" | "subsidised"];
    if (aCost !== bCost) return aCost - bCost;
    const aNational = a.national ? 0 : 1;
    const bNational = b.national ? 0 : 1;
    if (aNational !== bNational) return aNational - bNational;
    return a.durationWeeks - b.durationWeeks;
  });

  const best = candidates[0]!;
  return {
    title: best.title,
    provider: best.provider,
    providerKind: best.providerKind,
    durationWeeks: best.durationWeeks,
    cost: best.cost as "free" | "subsidised",
    costNote: best.costNote,
    outcome: best.outcome,
    url: best.url,
    sebenzaReviewed: best.sebenzaReviewed,
  };
}

/** Async wrapper: loads the live catalog from the DB, then applies the picker. */
export async function findFreeAlternativeForSkill(
  skillSlug: string,
  excludeTitles: string[] = [],
): Promise<FreeAlternative | null> {
  return pickFreeAlternative(
    await listAllLearningPaths(),
    skillSlug,
    excludeTitles,
  );
}
