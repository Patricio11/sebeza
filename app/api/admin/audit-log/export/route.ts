/**
 * Phase 7 (A.5)  CSV export of `/admin/audit-log`.
 *
 * Streams a real CSV file with the same filters as the page form.
 * Hard-capped at 10 000 rows per re-check #6  anything bigger goes
 * through the Phase 8 "we'll email you the file" hook.
 *
 * Every export writes its own `analytics.export` audit row so the
 * action is itself accountable.
 */

import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  logAccess,
  recentAuditEventsFromDb,
  type AuditKind,
} from "@/lib/audit";

const ROW_CAP = 10_000;

/**
 * OWASP CSV-injection guard. Cells starting with `=+-@\t\r` get a
 * leading single quote so spreadsheet apps treat them as text. Already
 * applied across the analytics CSV (Phase 6.5 fix); we share the rule.
 */
function safeCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // RFC 4180: escape inner double-quotes by doubling them, then wrap.
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

export async function GET(request: Request) {
  const session = await verifyAdmin();
  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind") ?? "";
  const actor = (url.searchParams.get("actor") ?? "").slice(0, 200);
  const kind = (kindParam || null) as AuditKind | null;

  const rows = await recentAuditEventsFromDb({
    kind,
    actor,
    limit: ROW_CAP,
  });

  const header = ["at_utc", "kind", "actor", "subject", "meta_json"];
  const lines = [header.map(safeCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.at,
        r.kind,
        r.actor,
        r.subject ?? "",
        r.meta ? JSON.stringify(r.meta) : "",
      ]
        .map(safeCell)
        .join(","),
    );
  }
  // Windows-friendly CRLF; UTF-8 BOM so Excel renders unicode correctly.
  const body = "﻿" + lines.join("\r\n") + "\r\n";

  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/admin/audit-log",
      rowCount: rows.length,
      filterKind: kind ?? null,
      filterActor: actor || null,
      capped: rows.length === ROW_CAP,
    },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sebenza-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
