/**
 * The `= ANY(${jsArray})` trap, guarded at the source.
 *
 * Drizzle binds a JS array interpolated into a raw `sql` fragment as a
 * parameter LIST, so the SQL that reaches Postgres reads
 * `WHERE skill_slug = ANY(($1, $2))`. That is a row constructor, not an
 * array, and the server rejects it: 42809 "op ANY/ALL (array) requires
 * array on right side". It has shipped twice now:
 *
 *   - 2026-08 (compass fuel) on the Neon driver.
 *   - 2026-09-10: `db/queries/student-lane.ts` 500'd the ENTIRE Career
 *     Compass for every seeker with an academic profile, on both drivers.
 *
 * `inArray(column, values)` is the correct shape and Drizzle emits the
 * right SQL for it. An array that genuinely lives in a COLUMN or in a
 * subquery is fine, but it must be written literally (`ANY(ps.skills)`,
 * `ANY(SELECT ...)`), never through an interpolation, so this scan stays
 * a simple, honest yes/no.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components", "db", "lib"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      out.push(full);
  }
  return out;
}

/** Strip comments so the explanation above is not itself a hit. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("SQL array binding", () => {
  test("no template interpolation on the right-hand side of ANY()", () => {
    const offenders = ROOTS.flatMap((r) => walk(r)).filter((f) =>
      /ANY\(\s*\$\{/.test(code(f)),
    );
    expect(
      offenders,
      "ANY(${...}) binds a JS array as a row constructor and fails at " +
        "runtime with Postgres 42809. Use inArray(column, values):\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
