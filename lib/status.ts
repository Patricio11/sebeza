/**
 * Employment-status freshness engine  the platform's differentiator.
 *
 * Status-Freshness Rule (TO_START_EVERY_SESSION.md §7): every public profile
 * carries a `statusConfirmedAt` timestamp. The age of that timestamp drives:
 *   - Search ranking (stale = down-ranked, fresh = up-ranked)
 *   - Analytics weighting (national figures are weighted by data freshness)
 *   - The re-confirmation nudge on the seeker dashboard
 *
 * Bands match the ROADMAP appendix:
 *   fresh   < 30 days   → full weight
 *   ageing  30–90 days  → soft down-rank + nudge shown
 *   stale   ≥ 90 days   → hard down-rank + nudge prominent
 *
 * The canonical implementation lives here. `lib/mock/helpers.ts` and the
 * Phase 4 SQL ranking function both consume these.
 */

import type { FreshnessBand } from "@/lib/mock/types";

export type StatusInput = string | Date;

function asDate(input: StatusInput): Date {
  return input instanceof Date ? input : new Date(input);
}

export function daysSince(input: StatusInput, reference: Date = new Date()): number {
  return (reference.getTime() - asDate(input).getTime()) / (1000 * 60 * 60 * 24);
}

export function freshnessBand(
  statusConfirmedAt: StatusInput,
  reference: Date = new Date(),
): FreshnessBand {
  const days = daysSince(statusConfirmedAt, reference);
  if (days < 30) return "fresh";
  if (days < 90) return "ageing";
  return "stale";
}

/** 0..1 confidence weight derived from freshness band. Used in ranking + analytics. */
export function freshnessConfidence(band: FreshnessBand): number {
  switch (band) {
    case "fresh":
      return 1.0;
    case "ageing":
      return 0.6;
    case "stale":
      return 0.25;
  }
}

export interface FreshnessSummary {
  band: FreshnessBand;
  /** Whole days since the user last confirmed their status. */
  days: number;
  /** True when the dashboard nudge banner should show (ageing or stale). */
  nudge: boolean;
  /** True when the nudge is prominent / high-emphasis (stale). */
  urgent: boolean;
}

export function freshnessSummary(
  statusConfirmedAt: StatusInput,
  reference: Date = new Date(),
): FreshnessSummary {
  const days = Math.floor(daysSince(statusConfirmedAt, reference));
  const band = freshnessBand(statusConfirmedAt, reference);
  return {
    band,
    days,
    nudge: band !== "fresh",
    urgent: band === "stale",
  };
}
