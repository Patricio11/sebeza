/**
 * Phase 11.2.2  free-alternative lookup.
 *
 * Pure helper over the static `MOCK_COMPASS.learningPaths` catalog
 * (Phase 6 swaps this for a DB-backed providers table when the
 * curriculum dataset lands  the signature is stable). Returns the
 * best free/subsidised path that unlocks the requested skill.
 *
 * Ordering rules (codified, not heuristic):
 *   1. Prefer `cost === "free"` over `cost === "subsidised"`.
 *   2. Prefer `national === true` (works for seekers outside major
 *      metros).
 *   3. Prefer shorter durationWeeks (lower commitment ask).
 *
 * Excludes any path the caller passes in `excludeTitles`  used by the
 * modal to avoid recommending the same path the seeker just abandoned
 * (or any prior path they bailed on for the same skill).
 *
 * Returns null when nothing matches; the caller falls back to the
 * default abandon flow without surfacing a fake recommendation.
 */

import {
  MOCK_COMPASS,
  type LearningPath,
} from "@/lib/mock/growth";
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

export function findFreeAlternativeForSkill(
  skillSlug: string,
  excludeTitles: string[] = [],
): FreeAlternative | null {
  const skill = SKILLS.find((s) => s.slug === skillSlug);
  if (!skill) return null;
  const skillLabel = skill.label.toLowerCase();
  const excludeSet = new Set(excludeTitles);

  const candidates = MOCK_COMPASS.learningPaths.filter((p) => {
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
