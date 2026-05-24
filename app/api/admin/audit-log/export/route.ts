/**
 * Phase 7 (A.5)  CSV export of `/admin/audit-log`.
 *
 * Streams a real CSV file with the same filters as the page form.
 * Hard-capped at 10 000 rows per re-check #6  anything bigger goes
 * through the Phase 8 "we'll email you the file" hook.
 *
 * Every export writes its own `analytics.export` audit row so the
 * action is itself accountable.
 *
 * CSV encoding (BOM + CRLF + OWASP guard + RFC 4180) lives in the
 * shared `lib/analytics/csv` helper since Phase 9.7.2 added a third
 * analytics export.
 */

import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  logAccess,
  recentAuditEventsFromDb,
  type AuditKind,
} from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";

const ROW_CAP = 10_000;

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

  const body = csvFromRows(
    ["at_utc", "kind", "actor", "subject", "meta_json"],
    rows.map((r) => [
      r.at,
      r.kind,
      r.actor,
      r.subject ?? "",
      r.meta ? JSON.stringify(r.meta) : "",
    ]),
  );

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

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition("audit"),
      "Cache-Control": "no-store",
    },
  });
}
