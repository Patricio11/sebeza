/**
 * House input rule (founder standing instruction, 2026-08):
 * every control the user touches is a CUSTOM Sebenza component  no raw
 * `<select>`, no `<input type="date">`. Native pickers look different on
 * every Android build and, for date of birth, hide the year jumper
 * entirely (a real user had to page back month-by-month to 2005).
 *
 * This walks the source tree so a regression fails the suite instead of
 * shipping.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components"];
/** Wider net for the punctuation rule: anything a human reads. */
const PROSE_ROOTS = ["app", "components", "lib", "db", "messages", "docs", "tests"];
const PROSE_EXT = /\.(tsx?|md|json|sql)$/;
const ALLOWED_FILES = new Set([
  // The custom components themselves.
  path.join("components", "ui", "DatePicker.tsx"),
  path.join("components", "ui", "MonthYearPicker.tsx"),
  path.join("components", "ui", "CustomSelect.tsx"),
]);

function walk(dir: string, out: string[] = [], match = /\.tsx$/): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out, match);
    else if (match.test(entry)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r)).filter((f) => !ALLOWED_FILES.has(f));

/** Strip comments so prose like "replaces plain <select>" isn't a hit. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("house input rule", () => {
  test("no native date inputs outside the custom picker", () => {
    const offenders = files.filter((f) => /type=["']date["']/.test(code(f)));
    expect(
      offenders,
      `Use <DatePicker> instead of <input type="date">:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("no raw <select> elements", () => {
    const offenders = files.filter((f) => /<select[\s>]/.test(code(f)));
    expect(
      offenders,
      `Use <CustomSelect> / <ComboboxField> instead of <select>:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

/**
 * House punctuation rule (founder standing instruction): NO em-dashes
 * anywhere, in copy, comments or docs. They read as an AI tell. Use a
 * colon, a comma, or a full stop.
 */
describe("house punctuation rule", () => {
  test("no em-dashes anywhere a human reads", () => {
    // Written as an escape on purpose: this file is inside the scan.
    const EM_DASH = String.fromCharCode(0x2014);
    const prose = PROSE_ROOTS.flatMap((r) => walk(r, [], PROSE_EXT));
    const offenders = prose.filter((f) =>
      readFileSync(f, "utf8").includes(EM_DASH),
    );
    expect(
      offenders,
      `Em-dash found. Use a colon, comma or full stop: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
