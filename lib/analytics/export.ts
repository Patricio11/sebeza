"use server";

/**
 * Phase 6  CSV export of aggregate analytics.
 *
 * Stream-style return: the Server Action returns a `{ ok, filename, csv }`
 * payload; the client component triggers a download via a Blob. All exports
 * are aggregate-only  never per-row PII.
 *
 * Every export writes an `analytics.export` audit row with:
 *   - `actor` = userId (or "anonymous" for the public /insights button)
 *   - `meta` = { scope, rowCount, generatedAt }
 *
 * Phase 8 wires a "request full export by email" flow for slices that
 * would exceed the in-product cap (10k rows).
 */

import { getSessionUser } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import {
  analyticsSnapshotQuery,
  skillsGapQuery,
  supplyHeatmapQuery,
  freshnessBreakdownQuery,
} from "@/db/queries/analytics";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const EXPORT_ROW_CAP = 10_000;

export async function exportInsightsCsv(): Promise<
  ActionResult<{ filename: string; csv: string; rowCount: number }>
> {
  const session = await getSessionUser();

  const [snapshot, skillsGap, heatmap, freshness] = await Promise.all([
    analyticsSnapshotQuery(),
    skillsGapQuery({ top: EXPORT_ROW_CAP }),
    supplyHeatmapQuery(),
    freshnessBreakdownQuery(),
  ]);

  // ── Compose the CSV. Multiple logical sections joined by a blank line.
  const lines: string[] = [];

  lines.push("# Sebenza national insights export");
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(
    `# Provider: ${process.env.SEBENZA_DATA_PROVIDER ?? "mock"} · cap: ${EXPORT_ROW_CAP} rows`,
  );
  lines.push("");

  // Section 1  Status breakdown
  lines.push("Section,Status,Count,FreshnessConfidence");
  for (const [status, bucket] of Object.entries(snapshot.byStatus)) {
    lines.push(
      `byStatus,${csvCell(status)},${bucket.count},${bucket.freshnessConfidence.toFixed(3)}`,
    );
  }
  lines.push("");

  // Section 2  Skills gap
  lines.push("Section,Skill,Searches,Matches,FreshMatches,Gap");
  for (const r of skillsGap) {
    lines.push(
      `skillsGap,${csvCell(r.skill)},${r.searches},${r.matches},${r.freshMatches.toFixed(2)},${r.gap}`,
    );
  }
  lines.push("");

  // Section 3  Supply heatmap (province × profession)
  lines.push("Section,Province,Profession,Supply,Freshness");
  for (const c of heatmap) {
    lines.push(
      `heatmap,${csvCell(c.province)},${csvCell(c.profession)},${c.supply},${c.freshness.toFixed(3)}`,
    );
  }
  lines.push("");

  // Section 4  Freshness breakdown
  lines.push("Section,Band,Count");
  lines.push(`freshness,fresh,${freshness.fresh}`);
  lines.push(`freshness,ageing,${freshness.ageing}`);
  lines.push(`freshness,stale,${freshness.stale}`);
  lines.push(`freshness,total,${freshness.total}`);
  lines.push("");

  // Section 5  Trend
  lines.push("Section,Month,Registrations,Placements");
  for (const t of snapshot.trend) {
    lines.push(`trend,${csvCell(t.month)},${t.registrations},${t.placements}`);
  }

  // RFC 4180 line endings  Excel on Windows needs CRLF, others accept it.
  const csv = lines.join("\r\n");
  const rowCount =
    skillsGap.length +
    heatmap.length +
    snapshot.trend.length +
    Object.keys(snapshot.byStatus).length +
    4;

  const filename = `sebenza-insights-${new Date().toISOString().slice(0, 10)}.csv`;

  await logAccess({
    kind: "analytics.export",
    actor: session?.id ?? "anonymous",
    meta: {
      scope: "insights",
      rowCount,
      generatedAt: new Date().toISOString(),
    },
  });

  if (rowCount > EXPORT_ROW_CAP) {
    return fail(
      `Export exceeded the in-product cap (${EXPORT_ROW_CAP} rows). Phase 8 will add an "email me the full file" flow for bigger slices.`,
    );
  }

  return ok({ filename, csv, rowCount });
}

/**
 * CSV-escape per RFC 4180 + formula-injection guard.
 *
 * Cells starting with `=` `+` `-` `@` `\t` are executed as formulas by
 * Excel / LibreOffice when the CSV is opened  a malicious search term in
 * `search_events.terms` would otherwise pop calc on an analyst's machine.
 * OWASP-recommended fix: prefix the cell with a single quote, which Excel
 * displays as content and never interprets.
 *
 *   https://owasp.org/www-community/attacks/CSV_Injection
 *
 * Standard quoting + double-quote escape still applies for cells containing
 * commas, quotes, or newlines.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}
