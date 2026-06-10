/**
 * Phase 12 (Task 12.1) — CSV export hardening fixtures.
 *
 * Pins the Phase 6.5 security fixes that every analytics/audit export now
 * routes through:
 *
 *   - OWASP CSV-injection guard: cells starting with = + - @ TAB CR get a
 *     leading apostrophe so spreadsheet apps treat them as text. A regression
 *     here lets a profile field like `=HYPERLINK(...)` execute in a gov
 *     analyst's Excel.
 *   - RFC 4180 quoting: inner double-quotes doubled, every cell wrapped.
 *   - UTF-8 BOM + CRLF line endings (Windows Excel compatibility).
 */

import { describe, expect, test } from "vitest";
import { csvDisposition, csvFromRows, safeCell } from "./csv";

describe("safeCell — OWASP injection guard", () => {
  test.each([
    ["=SUM(A1:A9)", '"\'=SUM(A1:A9)"'],
    ["+27821234567", '"\'+27821234567"'],
    ["-1234", '"\'-1234"'],
    ["@import", '"\'@import"'],
    ["\tindented", "\"'\tindented\""],
    ["\rcarriage", "\"'\rcarriage\""],
  ])("formula-shaped cell %j is apostrophe-prefixed", (input, expected) => {
    expect(safeCell(input)).toBe(expected);
  });

  test("ordinary text is quoted but not prefixed", () => {
    expect(safeCell("Software Developer")).toBe('"Software Developer"');
  });

  test("formula char mid-cell is NOT prefixed (only leading position is dangerous)", () => {
    expect(safeCell("a=b")).toBe('"a=b"');
  });
});

describe("safeCell — RFC 4180 quoting", () => {
  test("inner double-quotes are doubled", () => {
    expect(safeCell('Discovery "Bank" Ltd')).toBe('"Discovery ""Bank"" Ltd"');
  });

  test("null and undefined become empty quoted cells", () => {
    expect(safeCell(null)).toBe('""');
    expect(safeCell(undefined)).toBe('""');
  });

  test("numbers and booleans are stringified", () => {
    expect(safeCell(42)).toBe('"42"');
    expect(safeCell(false)).toBe('"false"');
  });

  test("commas and newlines stay inside the quoted cell", () => {
    expect(safeCell("Cape Town, WC\nZA")).toBe('"Cape Town, WC\nZA"');
  });
});

describe("csvFromRows — document shape", () => {
  const out = csvFromRows(
    ["skill", "demand"],
    [
      ["react", 120],
      ["=evil()", 3],
    ],
  );

  test("starts with a UTF-8 BOM", () => {
    expect(out.charCodeAt(0)).toBe(0xfeff);
  });

  test("uses CRLF line endings including a trailing newline", () => {
    expect(out.endsWith("\r\n")).toBe(true);
    // BOM + 3 lines → 3 CRLFs, and no bare \n outside a \r\n pair.
    expect(out.split("\r\n")).toHaveLength(4); // 3 lines + trailing ""
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");
  });

  test("header + rows all pass through safeCell", () => {
    const lines = out.slice(1).split("\r\n");
    expect(lines[0]).toBe('"skill","demand"');
    expect(lines[1]).toBe('"react","120"');
    expect(lines[2]).toBe('"\'=evil()","3"');
  });

  test("zero rows still yields a valid header-only document", () => {
    const empty = csvFromRows(["a"], []);
    expect(empty).toBe(`﻿"a"\r\n`);
  });
});

describe("csvDisposition", () => {
  test("date-stamped attachment filename with the sebenza- prefix", () => {
    const at = new Date("2026-06-10T08:30:00.000Z");
    expect(csvDisposition("skills-gap", at)).toBe(
      'attachment; filename="sebenza-skills-gap-2026-06-10T08-30-00-000Z.csv"',
    );
  });
});
