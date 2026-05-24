/**
 * Shared CSV-export primitives for analytics surfaces.
 *
 * Two earlier export routes (audit log + outcomes) re-implemented the
 * same safeCell encoder + BOM + CRLF + RFC 4180 pattern. Phase 9.7
 * adds a third (nationality mix), so the encoder is hoisted here and
 * the two original routes call into it.
 *
 * Hardening notes:
 *   - OWASP CSV-injection guard. Cells starting with `=+-@\t\r` get a
 *     leading single quote so spreadsheet apps treat them as text.
 *   - RFC 4180 quote escaping: inner double-quotes are doubled, then
 *     the whole cell wraps in `"…"`.
 *   - UTF-8 BOM so Excel for Windows renders Unicode correctly.
 *   - CRLF line endings so the file opens identically across platforms.
 *
 * Disclosure-control rule (Phase 9.7):
 *   For any export of a suppressed dataset, run `suppress()` from
 *   `lib/analytics/suppress.ts` BEFORE feeding rows to `csvFromRows()`.
 *   The encoder does not suppress; the boundary must.
 */

const UTF8_BOM = "﻿";

export function safeCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * Build a CSV body from a header row + data rows. Each value is run
 * through `safeCell` and joined with commas. Lines are CRLF-separated
 * and the result is prefixed with a UTF-8 BOM.
 */
export function csvFromRows(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [header.map(safeCell).join(",")];
  for (const r of rows) {
    lines.push(r.map(safeCell).join(","));
  }
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Build a Content-Disposition value with a date-stamped filename.
 * Centralised so every analytics CSV has a consistent name shape.
 */
export function csvDisposition(slug: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  return `attachment; filename="sebenza-${slug}-${stamp}.csv"`;
}
