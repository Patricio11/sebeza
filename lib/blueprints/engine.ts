/**
 * The gap engine: blueprint minus profile, ranked with evidence. Pure and
 * DB-free so it is unit-testable and cheap: the compass query hands it the
 * rows and the seeker's canonical skill slugs; it hands back what the page
 * renders. No suggestion leaves here without a reason a seeker can read.
 */

import type { BlueprintRow, BlueprintTier } from "./catalogue";

export interface DemandSignal {
  searches: number;
  matches: number;
}

export interface RouteSkill {
  slug: string;
  label: string;
  owned: boolean;
  proveIt: string | null;
  demand: DemandSignal | null;
}

export interface RouteTrack {
  name: string;
  skills: RouteSkill[];
  ownedCount: number;
  /** Sum of local searches for the track's skills; ranks tracks. */
  demandScore: number;
}

export interface RouteMap {
  core: RouteSkill[];
  expected: RouteSkill[];
  tracks: RouteTrack[];
  coreCovered: number;
  expectedCovered: number;
}

export type BlueprintReason = "role_core" | "role_expected" | "role_next_level";

export interface BlueprintGap {
  slug: string;
  label: string;
  tier: BlueprintTier;
  reason: BlueprintReason;
  track: string | null;
  proveIt: string | null;
  demand: DemandSignal | null;
  /** One honest sentence for the card. */
  detail: string;
}

interface EngineInput {
  rows: BlueprintRow[];
  ownedSlugs: ReadonlySet<string>;
  labelBySlug: ReadonlyMap<string, string>;
  demandBySlug?: ReadonlyMap<string, DemandSignal>;
  professionLabel: string;
}

function label(map: ReadonlyMap<string, string>, slug: string): string {
  return map.get(slug) ?? slug;
}

export function buildRouteMap(input: EngineInput): RouteMap {
  const { rows, ownedSlugs, labelBySlug, demandBySlug } = input;
  const toSkill = (r: BlueprintRow): RouteSkill => ({
    slug: r.skillSlug,
    label: label(labelBySlug, r.skillSlug),
    owned: ownedSlugs.has(r.skillSlug),
    proveIt: r.proveIt,
    demand: demandBySlug?.get(r.skillSlug) ?? null,
  });
  const core = rows.filter((r) => r.tier === "core").map(toSkill);
  const expected = rows.filter((r) => r.tier === "expected").map(toSkill);
  const byTrack = new Map<string, RouteSkill[]>();
  for (const r of rows.filter((r) => r.tier === "next_level")) {
    const name = r.track ?? "Next level";
    const list = byTrack.get(name) ?? [];
    list.push(toSkill(r));
    byTrack.set(name, list);
  }
  const tracks: RouteTrack[] = [...byTrack.entries()]
    .map(([name, skills]) => ({
      name,
      skills,
      ownedCount: skills.filter((s) => s.owned).length,
      demandScore: skills.reduce((n, s) => n + (s.demand?.searches ?? 0), 0),
    }))
    // Tracks with local demand first, then the ones the seeker has begun.
    .sort(
      (a, b) => b.demandScore - a.demandScore || b.ownedCount - a.ownedCount,
    );
  return {
    core,
    expected,
    tracks,
    coreCovered: core.filter((s) => s.owned).length,
    expectedCovered: expected.filter((s) => s.owned).length,
  };
}

/**
 * Ranked gaps: core first, then expected, then next-level ordered by local
 * demand and by tracks the seeker has already started. Deterministic.
 */
export function rankBlueprintGaps(input: EngineInput, max = 6): BlueprintGap[] {
  const map = buildRouteMap(input);
  const out: BlueprintGap[] = [];
  const prof = input.professionLabel;
  const withDemand = (s: RouteSkill, base: string) =>
    s.demand && s.demand.searches > 0
      ? `${base} ${s.demand.searches} employer ${s.demand.searches === 1 ? "search" : "searches"} near you mention it.`
      : base;

  for (const s of map.core.filter((s) => !s.owned)) {
    out.push({
      slug: s.slug,
      label: s.label,
      tier: "core",
      reason: "role_core",
      track: null,
      proveIt: s.proveIt,
      demand: s.demand,
      detail: withDemand(
        s,
        `Every ${prof} is expected to have this; it is missing from your profile.`,
      ),
    });
  }
  for (const s of map.expected.filter((s) => !s.owned)) {
    out.push({
      slug: s.slug,
      label: s.label,
      tier: "expected",
      reason: "role_expected",
      track: null,
      proveIt: s.proveIt,
      demand: s.demand,
      detail: withDemand(s, `Employers hiring a ${prof} assume this is there.`),
    });
  }
  const nextLevel = map.tracks
    .flatMap((t) => t.skills.filter((s) => !s.owned).map((s) => ({ s, t })))
    .sort(
      (a, b) =>
        (b.s.demand?.searches ?? 0) - (a.s.demand?.searches ?? 0) ||
        b.t.ownedCount - a.t.ownedCount,
    );
  for (const { s, t } of nextLevel) {
    const started =
      t.ownedCount > 0
        ? ` You already hold ${t.ownedCount} of ${t.skills.length} on this route.`
        : "";
    out.push({
      slug: s.slug,
      label: s.label,
      tier: "next_level",
      reason: "role_next_level",
      track: t.name,
      proveIt: s.proveIt,
      demand: s.demand,
      detail: withDemand(
        s,
        `Takes a ${prof} to the next level on the ${t.name} route.${started}`,
      ),
    });
  }
  return out.slice(0, max);
}
