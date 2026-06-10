/**
 * Phase 12 (Task 12.1) — Status-Freshness Rule fixtures.
 *
 * `lib/status.ts` is the platform's differentiator: its bands drive search
 * ranking, analytics confidence weighting, and the dashboard nudge. The
 * Phase 4 SQL function `sebenza_freshness_confidence` mirrors these numbers;
 * an integration fixture (Task 12.2) asserts the two agree. These unit
 * fixtures pin the canonical TypeScript side:
 *
 *   fresh   < 30 days  → confidence 1.0,  no nudge
 *   ageing  30–90 days → confidence 0.6,  nudge
 *   stale   ≥ 90 days  → confidence 0.25, nudge + urgent
 *
 * Boundary cases are tested at exactly 29/30/31 and 89/90/91 days because
 * an off-by-one here silently re-ranks the whole national search index.
 */

import { describe, expect, test } from "vitest";
import {
  daysSince,
  freshnessBand,
  freshnessConfidence,
  freshnessSummary,
} from "./status";

const REF = new Date("2026-06-10T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(REF.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("daysSince", () => {
  test("returns 0 for the reference instant", () => {
    expect(daysSince(REF, REF)).toBe(0);
  });

  test("returns exact fractional days", () => {
    expect(daysSince(daysAgo(1.5), REF)).toBeCloseTo(1.5, 10);
  });

  test("accepts ISO strings and Date objects identically", () => {
    const d = daysAgo(10);
    expect(daysSince(d.toISOString(), REF)).toBe(daysSince(d, REF));
  });
});

describe("freshnessBand boundaries", () => {
  test("29 days → fresh", () => {
    expect(freshnessBand(daysAgo(29), REF)).toBe("fresh");
  });

  test("just under 30 days → fresh", () => {
    expect(freshnessBand(daysAgo(29.999), REF)).toBe("fresh");
  });

  test("exactly 30 days → ageing (30 is NOT fresh)", () => {
    expect(freshnessBand(daysAgo(30), REF)).toBe("ageing");
  });

  test("31 days → ageing", () => {
    expect(freshnessBand(daysAgo(31), REF)).toBe("ageing");
  });

  test("89 days → ageing", () => {
    expect(freshnessBand(daysAgo(89), REF)).toBe("ageing");
  });

  test("just under 90 days → ageing", () => {
    expect(freshnessBand(daysAgo(89.999), REF)).toBe("ageing");
  });

  test("exactly 90 days → stale (90 is NOT ageing)", () => {
    expect(freshnessBand(daysAgo(90), REF)).toBe("stale");
  });

  test("91 days → stale", () => {
    expect(freshnessBand(daysAgo(91), REF)).toBe("stale");
  });

  test("a 2-year-old confirmation is stale", () => {
    expect(freshnessBand(daysAgo(730), REF)).toBe("stale");
  });

  test("a confirmation moments ago is fresh", () => {
    expect(freshnessBand(daysAgo(0), REF)).toBe("fresh");
  });
});

describe("freshnessConfidence weights (must match the Phase 4 SQL function)", () => {
  test("fresh → 1.0", () => {
    expect(freshnessConfidence("fresh")).toBe(1.0);
  });

  test("ageing → 0.6", () => {
    expect(freshnessConfidence("ageing")).toBe(0.6);
  });

  test("stale → 0.25", () => {
    expect(freshnessConfidence("stale")).toBe(0.25);
  });
});

describe("freshnessSummary (drives the dashboard nudge banner)", () => {
  test("fresh: no nudge, not urgent, whole-day floor", () => {
    expect(freshnessSummary(daysAgo(12.7), REF)).toEqual({
      band: "fresh",
      days: 12,
      nudge: false,
      urgent: false,
    });
  });

  test("ageing: nudge shown, not urgent", () => {
    expect(freshnessSummary(daysAgo(45), REF)).toEqual({
      band: "ageing",
      days: 45,
      nudge: true,
      urgent: false,
    });
  });

  test("stale: nudge shown AND urgent", () => {
    expect(freshnessSummary(daysAgo(120), REF)).toEqual({
      band: "stale",
      days: 120,
      nudge: true,
      urgent: true,
    });
  });

  test("boundary: exactly 30 days nudges (band flipped to ageing)", () => {
    const s = freshnessSummary(daysAgo(30), REF);
    expect(s.nudge).toBe(true);
    expect(s.urgent).toBe(false);
  });
});
