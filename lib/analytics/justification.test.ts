/**
 * Unit fixtures for the Justification Index classifier (Phase 9.7.3).
 *
 * Encodes the D1 rule (PHASE_9_7_PLAN.md, closed 2026-05-24). If a
 * fixture goes red after a code change, the policy meaning has
 * shifted  re-derive the expected label from the rule, do not
 * change the value to make the test pass.
 */

import { describe, expect, test } from "vitest";
import {
  classifyJustification,
  type JustificationCellInputs,
  type JustificationThresholds,
} from "./justification";

const DEFAULTS: JustificationThresholds = {
  demandFloor: 1.0,
  localSupplyThreshold: 0.5,
  foreignFillFloor: 0.5,
  minPlacements: 5,
};

function cell(over: Partial<JustificationCellInputs> = {}): JustificationCellInputs {
  return {
    demand_score: 0,
    local_supply_ratio: 0,
    foreign_fill_share: 0,
    total_placements: 0,
    ...over,
  };
}

describe("classifyJustification()", () => {
  test(
    "shortage  all four conditions met: high demand, thin local supply, " +
      "foreign-fill majority, enough placements",
    () => {
      const out = classifyJustification(
        cell({
          demand_score: 1.5, // >= demandFloor (1.0)
          local_supply_ratio: 0.3, // < threshold (0.5)
          foreign_fill_share: 0.7, // >= floor (0.5)
          total_placements: 8, // >= minPlacements (5)
        }),
        DEFAULTS,
      );
      expect(out).toBe("shortage");
    },
  );

  test("supply_available  demand met by SA citizens, ratio >= 1.0", () => {
    const out = classifyJustification(
      cell({
        demand_score: 2.0,
        local_supply_ratio: 1.5,
        // The other two don't matter here; supply_available short-circuits
        foreign_fill_share: 0.9,
        total_placements: 20,
      }),
      DEFAULTS,
    );
    expect(out).toBe("supply_available");
  });

  test(
    "supply_available  ratio exactly at 1.0 still qualifies (>=, not >)",
    () => {
      const out = classifyJustification(
        cell({ demand_score: 1.0, local_supply_ratio: 1.0 }),
        DEFAULTS,
      );
      expect(out).toBe("supply_available");
    },
  );

  test("indeterminate  demand below floor", () => {
    const out = classifyJustification(
      cell({
        demand_score: 0.5, // < 1.0
        local_supply_ratio: 0.1,
        foreign_fill_share: 0.9,
        total_placements: 100,
      }),
      DEFAULTS,
    );
    expect(out).toBe("indeterminate");
  });

  test(
    "indeterminate  high demand + thin supply + foreign-fill majority " +
      "but placements below the min-placement floor",
    () => {
      const out = classifyJustification(
        cell({
          demand_score: 1.5,
          local_supply_ratio: 0.3,
          foreign_fill_share: 0.7,
          total_placements: 3, // < 5
        }),
        DEFAULTS,
      );
      expect(out).toBe("indeterminate");
    },
  );

  test(
    "indeterminate  high demand + thin supply but foreign-fill share " +
      "below floor (placements went mostly to SA citizens)",
    () => {
      const out = classifyJustification(
        cell({
          demand_score: 1.5,
          local_supply_ratio: 0.3,
          foreign_fill_share: 0.2, // < 0.5
          total_placements: 8,
        }),
        DEFAULTS,
      );
      expect(out).toBe("indeterminate");
    },
  );

  test(
    "indeterminate  the gap zone: demand met, local supply sits between " +
      "the threshold and 1.0",
    () => {
      const out = classifyJustification(
        cell({
          demand_score: 1.5,
          local_supply_ratio: 0.7, // > threshold (0.5) but < 1.0
          foreign_fill_share: 0.7,
          total_placements: 8,
        }),
        DEFAULTS,
      );
      // Not "shortage" (supply isn't thin enough) and not
      // "supply_available" (ratio < 1.0). Honest blank.
      expect(out).toBe("indeterminate");
    },
  );

  test("supply_available beats shortage when ratio >= 1.0 (early return)", () => {
    const out = classifyJustification(
      cell({
        demand_score: 1.5,
        local_supply_ratio: 1.2, // >= 1.0
        foreign_fill_share: 0.9, // would qualify shortage if supply were thin
        total_placements: 50,
      }),
      DEFAULTS,
    );
    expect(out).toBe("supply_available");
  });

  test("boundary  demand exactly at floor classifies", () => {
    expect(
      classifyJustification(
        cell({ demand_score: 1.0, local_supply_ratio: 1.0 }),
        DEFAULTS,
      ),
    ).toBe("supply_available");
  });

  test("boundary  foreign_fill_share exactly at floor counts as floor met", () => {
    expect(
      classifyJustification(
        cell({
          demand_score: 1.5,
          local_supply_ratio: 0.3,
          foreign_fill_share: 0.5, // exactly at floor
          total_placements: 8,
        }),
        DEFAULTS,
      ),
    ).toBe("shortage");
  });

  test(
    "tunable  raising lmi_demand_floor lifts cells that used to classify " +
      "out into indeterminate",
    () => {
      const tight: JustificationThresholds = { ...DEFAULTS, demandFloor: 3.0 };
      const input = cell({
        demand_score: 1.5,
        local_supply_ratio: 0.3,
        foreign_fill_share: 0.7,
        total_placements: 8,
      });
      expect(classifyJustification(input, DEFAULTS)).toBe("shortage");
      expect(classifyJustification(input, tight)).toBe("indeterminate");
    },
  );
});
