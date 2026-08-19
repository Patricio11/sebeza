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
const ALLOWED_FILES = new Set([
  // The custom components themselves.
  path.join("components", "ui", "DatePicker.tsx"),
  path.join("components", "ui", "MonthYearPicker.tsx"),
  path.join("components", "ui", "CustomSelect.tsx"),
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
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
