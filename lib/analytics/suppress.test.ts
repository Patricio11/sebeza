/**
 * Unit fixtures for the suppression primitive (Phase 9.7.1).
 *
 * These codify the EXACT behaviour the outcomes engine relied on before
 * the extraction. They are the safety net the 9.7.1 refactor must not
 * tear: if you change `suppress()` and a fixture goes red, the outcomes
 * dataset's disclosure-control contract has shifted  re-derive the
 * fixture from the policy intent, do not just update the expected value.
 */

import { describe, expect, test } from "vitest";
import { suppress, type SuppressionAxis } from "./suppress";

interface CohortRow {
  programme: string;
  institution: string;
  province: string;
  graduation_year: number;
  cohort_size: number;
}

// The two complementary passes the outcomes engine has always run.
const OUTCOMES_AXES: SuppressionAxis<CohortRow>[] = [
  {
    // Row pass: within a (programme, institution, year), drop the
    // only surviving province if any sibling province was suppressed.
    groupBy: ["programme", "institution", "graduation_year"],
    complementOver: "province",
  },
  {
    // Column pass: within a (programme, institution, province), drop
    // the only surviving year if any sibling year was suppressed.
    groupBy: ["programme", "institution", "province"],
    complementOver: "graduation_year",
  },
];

const K = 10;

function row(
  province: string,
  year: number,
  size: number,
  programme = "BSc CS",
  institution = "wits",
): CohortRow {
  return {
    programme,
    institution,
    province,
    graduation_year: year,
    cohort_size: size,
  };
}

describe("suppress()", () => {
  test("empty input returns empty output, zero suppressed", () => {
    const out = suppress<CohortRow>([], {
      countKey: "cohort_size",
      k: K,
      axes: OUTCOMES_AXES,
    });
    expect(out.passed).toEqual([]);
    expect(out.suppressedCount).toBe(0);
  });

  test("all rows above k pass through unchanged", () => {
    const rows = [row("GP", 2024, 15), row("WC", 2024, 12)];
    const out = suppress(rows, {
      countKey: "cohort_size",
      k: K,
      axes: OUTCOMES_AXES,
    });
    expect(out.passed).toHaveLength(2);
    expect(out.suppressedCount).toBe(0);
  });

  test("all rows below k are dropped (primary suppression)", () => {
    const rows = [row("GP", 2024, 3), row("WC", 2024, 7)];
    const out = suppress(rows, {
      countKey: "cohort_size",
      k: K,
      axes: OUTCOMES_AXES,
    });
    expect(out.passed).toEqual([]);
    expect(out.suppressedCount).toBe(2);
  });

  test(
    "primary + row-axis complementary: a single surviving province in a " +
      "(programme, institution, year) group with at least one suppressed " +
      "sibling province is itself dropped",
    () => {
      const rows = [
        row("GP", 2024, 15), // would pass primary
        row("WC", 2024, 5), // suppressed by primary
      ];
      const out = suppress(rows, {
        countKey: "cohort_size",
        k: K,
        axes: OUTCOMES_AXES,
      });
      // The GP-2024 survivor is the only one in its row group, and WC was
      // suppressed  GP can be recovered as (row total  WC). Dropped.
      expect(out.passed).toEqual([]);
      expect(out.suppressedCount).toBe(2);
    },
  );

  test(
    "primary + col-axis complementary: a single surviving year in a " +
      "(programme, institution, province) group with a suppressed sibling " +
      "year is dropped",
    () => {
      const rows = [
        row("GP", 2024, 15),
        row("GP", 2023, 3), // suppressed by primary
      ];
      const out = suppress(rows, {
        countKey: "cohort_size",
        k: K,
        axes: OUTCOMES_AXES,
      });
      // Row pass: GP-2024 is the only cell in (BSc CS, wits, 2024); no
      // suppressed sibling province in that year (only GP exists in 2024).
      // Col pass: GP-2024 is the only cell in (BSc CS, wits, GP); GP-2023
      // was suppressed  derivable, drop GP-2024.
      expect(out.passed).toEqual([]);
      expect(out.suppressedCount).toBe(2);
    },
  );

  test(
    "two or more survivors in a group means no derivation possible  " +
      "neither is dropped by that axis pass",
    () => {
      const rows = [
        row("GP", 2024, 15),
        row("WC", 2024, 12),
        row("KZN", 2024, 3), // suppressed
      ];
      const out = suppress(rows, {
        countKey: "cohort_size",
        k: K,
        axes: OUTCOMES_AXES,
      });
      // Row pass: (BSc CS, wits, 2024) group has TWO survivors (GP, WC).
      // KZN was suppressed but cannot derive either of them with two
      // unknowns in the equation.
      expect(out.passed).toHaveLength(2);
      const passedKey = out.passed.map((r) => r.province).sort();
      expect(passedKey).toEqual(["GP", "WC"]);
      expect(out.suppressedCount).toBe(1);
    },
  );

  test(
    "no suppressed siblings  a lone survivor in a group is left alone " +
      "(nothing to derive from)",
    () => {
      // Only one province ever existed for this (programme, institution,
      // year). The cell is the row total; no subtraction is possible.
      const rows = [row("GP", 2024, 15)];
      const out = suppress(rows, {
        countKey: "cohort_size",
        k: K,
        axes: OUTCOMES_AXES,
      });
      expect(out.passed).toHaveLength(1);
      expect(out.suppressedCount).toBe(0);
    },
  );

  test(
    "different (programme, institution) groups are independent  " +
      "suppression in one does not bleed into the other",
    () => {
      const rows = [
        // Wits BSc CS: GP alone survives primary, WC suppressed  GP dropped
        row("GP", 2024, 15, "BSc CS", "wits"),
        row("WC", 2024, 5, "BSc CS", "wits"),
        // UCT BA Eng: two healthy provinces, nothing suppressed
        row("GP", 2024, 20, "BA Eng", "uct"),
        row("WC", 2024, 18, "BA Eng", "uct"),
      ];
      const out = suppress(rows, {
        countKey: "cohort_size",
        k: K,
        axes: OUTCOMES_AXES,
      });
      expect(out.passed).toHaveLength(2);
      const programmes = out.passed.map((r) => r.programme).sort();
      expect(programmes).toEqual(["BA Eng", "BA Eng"]);
      expect(out.suppressedCount).toBe(2); // WC-Wits primary + GP-Wits complementary
    },
  );

  test("no axes provided  only primary suppression runs", () => {
    const rows = [row("GP", 2024, 15), row("WC", 2024, 5)];
    const out = suppress(rows, {
      countKey: "cohort_size",
      k: K,
      axes: [],
    });
    expect(out.passed).toHaveLength(1);
    expect(out.passed[0]!.province).toBe("GP");
    expect(out.suppressedCount).toBe(1);
  });

  test("primary uses >=, not > (boundary k=10 passes for a cohort of 10)", () => {
    const rows = [row("GP", 2024, 10), row("WC", 2024, 9)];
    const out = suppress(rows, {
      countKey: "cohort_size",
      k: K,
      axes: OUTCOMES_AXES,
    });
    // GP=10 passes primary. WC=9 is suppressed. Then GP is the lone
    // survivor in its row group with a suppressed sibling  dropped.
    expect(out.passed).toEqual([]);
    expect(out.suppressedCount).toBe(2);
  });

  test(
    "row pass and col pass are independent  a cell that survives row " +
      "can still be dropped by col, and vice versa",
    () => {
      const rows = [
        row("GP", 2024, 15),
        row("WC", 2024, 12),
        row("GP", 2023, 3),
      ];
      const out = suppress(rows, {
        countKey: "cohort_size",
        k: K,
        axes: OUTCOMES_AXES,
      });
      // After primary: GP-2024, WC-2024 pass; GP-2023 suppressed.
      // Row pass: (BSc CS, wits, 2024) has 2 survivors  neither dropped.
      // Col pass: (BSc CS, wits, GP) has 1 survivor (GP-2024) AND a
      // suppressed sibling year (GP-2023)  GP-2024 dropped.
      //         (BSc CS, wits, WC) has 1 survivor (WC-2024) AND NO
      // suppressed sibling year (no WC-2023 ever existed)  WC-2024 stays.
      expect(out.passed).toHaveLength(1);
      expect(out.passed[0]!.province).toBe("WC");
      expect(out.suppressedCount).toBe(2);
    },
  );
});
