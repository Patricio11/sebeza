/**
 * Phase 12 (Task 12.1)  ISO 3166-1 country catalogue fixtures (Phase 9.16).
 *
 * The catalogue backs the passport-country picker, the
 * `passport-country-when-passport` compliance assertion, and the
 * `is_citizen` derivation (`code === "ZA"`) that feeds the Phase 9.7
 * 2-class nationality analytics. Fixtures pin: SA-first ordering, code
 * uniqueness/validity, and the flag-emoji rendering rules.
 */

import { describe, expect, test } from "vitest";
import {
  COUNTRIES,
  countryLabel,
  flagEmoji,
  isValidCountryCode,
} from "./countries";

describe("catalogue shape", () => {
  test("South Africa is pinned first (picker UX for 99% of users)", () => {
    expect(COUNTRIES[0]).toEqual({ code: "ZA", label: "South Africa" });
  });

  test("SADC neighbours head the list before the alphabetical world", () => {
    const headCodes = COUNTRIES.slice(0, 16).map((c) => c.code);
    for (const sadc of ["BW", "LS", "NA", "SZ", "ZW", "MZ", "ZM"]) {
      expect(headCodes).toContain(sadc);
    }
  });

  test("codes are unique, two-letter uppercase", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  test("labels are non-empty and unique", () => {
    const labels = COUNTRIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  test("covers (close to) the full ISO list", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(180);
  });
});

describe("isValidCountryCode", () => {
  test("known codes validate", () => {
    expect(isValidCountryCode("ZA")).toBe(true);
    expect(isValidCountryCode("ZW")).toBe(true);
    expect(isValidCountryCode("GB")).toBe(true);
  });

  test("unknown / malformed codes are rejected", () => {
    expect(isValidCountryCode("XX")).toBe(false);
    expect(isValidCountryCode("za")).toBe(false); // case-sensitive by design
    expect(isValidCountryCode("")).toBe(false);
    expect(isValidCountryCode("ZAF")).toBe(false); // alpha-3 is not accepted
  });
});

describe("flagEmoji", () => {
  test("renders the SA flag from regional indicators", () => {
    expect(flagEmoji("ZA")).toBe("🇿🇦");
  });

  test("rejects anything that is not two uppercase ASCII letters", () => {
    expect(flagEmoji("za")).toBe("");
    expect(flagEmoji("Z")).toBe("");
    expect(flagEmoji("ZAF")).toBe("");
    expect(flagEmoji("")).toBe("");
    expect(flagEmoji("Z1")).toBe("");
  });
});

describe("countryLabel", () => {
  test("resolves known codes", () => {
    expect(countryLabel("ZA")).toBe("South Africa");
  });

  test("falls back to the code itself for unknown codes (never blank)", () => {
    expect(countryLabel("XX")).toBe("XX");
  });

  test("null/undefined render as empty string", () => {
    expect(countryLabel(null)).toBe("");
    expect(countryLabel(undefined)).toBe("");
  });
});
