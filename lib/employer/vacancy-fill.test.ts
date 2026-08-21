import { describe, it, expect } from "vitest";
import { fillState, fillLabelParts } from "./vacancy-fill";

const base = { positions: null, acceptedCount: 0, placementCount: 0 };

describe("fillState", () => {
  it("has no opinion when no target was set", () => {
    const s = fillState({ ...base, acceptedCount: 3 });
    expect(s.remaining).toBeNull();
    expect(s.isShort).toBe(false);
    expect(fillLabelParts(s)).toBeNull();
  });

  it("counts acceptances while nobody has been hired yet", () => {
    const s = fillState({ positions: 5, acceptedCount: 2, placementCount: 0 });
    expect(s).toMatchObject({ filled: 2, remaining: 3, basis: "acceptances", isShort: true });
    expect(fillLabelParts(s)).toEqual({ id: "acceptedShort", params: { positions: 5, filled: 2, remaining: 3 } });
  });

  it("switches to placements once hires are logged, and does NOT add them up", () => {
    // The same person accepted and was then hired. Summing would report
    // two seats filled by one human.
    const s = fillState({ positions: 3, acceptedCount: 1, placementCount: 1 });
    expect(s.filled).toBe(1);
    expect(s.basis).toBe("placements");
    expect(fillLabelParts(s)).toEqual({ id: "hiredShort", params: { positions: 3, filled: 1, remaining: 2 } });
  });

  it("never says 'hired', or 'all filled', about a mere acceptance", () => {
    // Enough acceptances to cover the seats is NOT the same as having
    // hired anyone: they can still fall through. A recruiter who reads
    // "all filled" and stops looking has been misled.
    const s = fillState({ positions: 2, acceptedCount: 2, placementCount: 0 });
    expect(s.isMet).toBe(true);
    // The id is "accepted", never "allFilled" or a hired variant: enough
    // acceptances to cover the seats is still not a hire, in any language.
    expect(fillLabelParts(s)).toEqual({ id: "accepted", params: { positions: 2, filled: 2, remaining: 0 } });
  });

  it("reports a met target without a remaining nag", () => {
    const s = fillState({ positions: 2, acceptedCount: 0, placementCount: 2 });
    expect(s).toMatchObject({ isMet: true, isShort: false, isOver: false, remaining: 0 });
    expect(fillLabelParts(s)).toEqual({ id: "allFilled", params: { positions: 2, filled: 2, remaining: 0 } });
  });

  it("shows over-filling rather than clamping it out of sight", () => {
    const s = fillState({ positions: 2, acceptedCount: 0, placementCount: 3 });
    expect(s).toMatchObject({ isOver: true, isMet: true, remaining: 0 });
    expect(fillLabelParts(s)).toEqual({ id: "overHired", params: { positions: 2, filled: 3, remaining: 0 } });
  });

  it("treats a zero or negative target as no target", () => {
    for (const positions of [0, -1]) {
      expect(fillState({ ...base, positions }).positions).toBeNull();
    }
  });

  it("says so plainly when a target exists and nothing has happened", () => {
    expect(fillLabelParts(fillState({ ...base, positions: 4 }))).toEqual({
      id: "noneYet",
      params: { positions: 4, filled: 0, remaining: 4 },
    });
  });

  it("uses the singular for one seat", () => {
    expect(
      fillLabelParts(fillState({ positions: 1, acceptedCount: 0, placementCount: 0 }))?.id,
    ).toBe("noneYet");
  });
});
