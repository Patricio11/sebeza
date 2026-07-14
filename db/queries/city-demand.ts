/**
 * Phase 21 ("Hyper-Local Demand")  city-level employer demand for the seeker's
 * own metro, behind THREE gates so the signal is both honest + privacy-safe:
 *
 *   1. `feature_flag_city_demand` is ON (the surface switch).
 *   2. The seeker's city is a top-5 metro (sub-metro towns are too small to
 *      surface city-level cuts without re-identification risk).
 *   3. The seeker has `outcomes_research` consent (city-level insight is a
 *      research-grade tier the seeker opts into).
 *
 * AND each returned segment must clear a search-count floor (k-anonymity-style
 * suppression of thin cells). Any gate failing → `null`, and the caller silently
 * falls back to the province rail  no empty state, no "we'd show you more if…".
 *
 * Demand-side only (employer searches, never a seeker cohort).
 */

import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getSetting } from "@/lib/admin/settings";
import { hasConsent } from "@/lib/consent/check";

/** Top-5 metros (city slugs). City-level demand surfaces ONLY for these. */
export const TOP_METRO_SLUGS = new Set([
  "johannesburg",
  "cape-town",
  "durban",
  "pretoria",
  "gqeberha",
]);

/** A segment needs at least this many searches to surface (thin-cell floor). */
export const CITY_DEMAND_FLOOR = 5;
const WINDOW_DAYS = 90;
const MAX_HOTSPOTS = 4;

export interface CityHotspot {
  label: string;
  searches: number;
}

export interface CityDemand {
  city: string;
  hotspots: CityHotspot[];
}

function citySlug(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Returns the seeker's city demand hotspots, or null when any gate closes. */
export async function getCityDemandHotspots(opts: {
  cityLabel: string;
  userId: string;
}): Promise<CityDemand | null> {
  // Gate 1  surface flag.
  const enabled = await getSetting<boolean>("feature_flag_city_demand");
  if (!enabled) return null;

  // Gate 2  top-5 metro only.
  const slug = citySlug(opts.cityLabel);
  if (!TOP_METRO_SLUGS.has(slug)) return null;

  // Gate 3  the seeker's research-insights consent.
  const consented = await hasConsent(opts.userId, "outcomes_research");
  if (!consented) return null;

  const db = getDb();
  const result = await db.execute(sql`
    SELECT terms AS label, COUNT(*)::int AS searches
    FROM search_events
    WHERE filters->>'city' = ${slug}
      AND terms IS NOT NULL
      AND length(terms) >= 2
      AND at >= now() - (${WINDOW_DAYS} || ' days')::interval
    GROUP BY terms
    HAVING COUNT(*) >= ${CITY_DEMAND_FLOOR}
    ORDER BY searches DESC, terms ASC
    LIMIT ${MAX_HOTSPOTS}
  `);
  const rows = (
    result as unknown as { rows: Array<{ label: string; searches: number }> }
  ).rows;
  if (rows.length === 0) return null;

  return { city: opts.cityLabel, hotspots: rows };
}
