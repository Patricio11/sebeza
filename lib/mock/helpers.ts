import type { PublicProfile, SearchFilters } from "./types";
// Canonical status-freshness engine lives in `lib/status.ts` (Phase 3).
// Re-exported here so existing imports (`@/lib/mock/helpers`) keep working.
import { freshnessBand, freshnessConfidence } from "@/lib/status";
export { freshnessBand, freshnessConfidence };

/** Deterministic completeness score — shared between client + server. */
export function computeCompleteness(p: Pick<
  PublicProfile,
  "bio" | "topSkills" | "experience" | "qualifications" | "city"
>): number {
  let score = 0;
  if (p.city) score += 10;
  if (p.bio && p.bio.length > 40) score += 20;
  score += Math.min(30, (p.topSkills?.length ?? 0) * 6);
  score += Math.min(25, (p.experience?.length ?? 0) * 10);
  score += Math.min(15, (p.qualifications?.length ?? 0) * 8);
  return Math.min(100, score);
}

/**
 * Mirrors the eventual Postgres ranking SQL (Phase 4 §4.2) so search "feels"
 * identical before and after the backend swap. Relevance × freshness × completeness
 * × (optional citizen highlight). Stale statuses fall to the bottom honestly.
 */
export function rankProfiles(
  profiles: PublicProfile[],
  filters: SearchFilters,
  reference: Date = new Date(),
): PublicProfile[] {
  const q = filters.query?.trim().toLowerCase() ?? "";

  return profiles
    .filter((p) => matchesFilters(p, filters))
    .map((p) => {
      const band = freshnessBand(p.statusConfirmedAt, reference);
      const fresh = freshnessConfidence(band);
      const relevance = scoreRelevance(p, q);
      const completeness = p.completeness / 100;
      const citizenBoost =
        filters.highlightCitizens && p.isCitizen ? 1.08 : 1.0;
      const score = relevance * fresh * (0.5 + 0.5 * completeness) * citizenBoost;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

function scoreRelevance(p: PublicProfile, q: string): number {
  if (!q) return 1; // no query → neutral relevance
  let s = 0;
  if (p.profession.toLowerCase().includes(q)) s += 1.0;
  for (const k of p.topSkills) {
    if (k.name.toLowerCase().includes(q)) s += 0.5;
  }
  if (p.city.toLowerCase().includes(q)) s += 0.2;
  if (p.displayName.toLowerCase().includes(q)) s += 0.1;
  return s === 0 ? 0.05 : s;
}

function matchesFilters(p: PublicProfile, f: SearchFilters): boolean {
  if (f.province && slug(p.province) !== f.province) return false;
  if (f.city && slug(p.city) !== f.city) return false;
  if (f.status && p.status !== f.status) return false;
  if (f.seniority && p.seniority !== f.seniority) return false;
  if (f.verification && p.verification !== f.verification) return false;
  return true;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
