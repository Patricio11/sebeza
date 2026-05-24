/**
 * Phase 9.7.7  CSV export of the sensitive-query oversight log.
 *
 *   GET /api/admin/oversight/export?actor=<sub>&employer=<name>&since=<iso>&until=<iso>
 *
 * Admin-only via verifyAdmin(). Same filter shape as the page so a
 * "what I'm looking at" CSV download mirrors the on-screen state.
 *
 * Each lookup row is exploded into its key meta fields (reason,
 * placement_count, above_floor, etc.) so analysts can pivot in a
 * spreadsheet without parsing JSON. Each export row carries the
 * surface tag so the same kind shows two distinct shapes on one CSV
 * (lookup vs nationality export).
 *
 * Self-references: this export itself is an analytics.export event,
 * audit-logged with surface "/admin/oversight" so a future "watch
 * the watchers of the watchers" view (not in scope for 9.7) could
 * surface it.
 */

import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { csvDisposition, csvFromRows } from "@/lib/analytics/csv";
import { oversightLogQuery } from "@/lib/gov/oversight-query";
import { REASON_LABELS } from "@/lib/gov/employer-lookup-types";

const ROW_CAP = 10_000;

export async function GET(request: Request) {
  const session = await verifyAdmin();
  const url = new URL(request.url);
  const actor = (url.searchParams.get("actor") ?? "").slice(0, 200);
  const employer = (url.searchParams.get("employer") ?? "").slice(0, 200);
  const since = (url.searchParams.get("since") ?? "").slice(0, 32);
  const until = (url.searchParams.get("until") ?? "").slice(0, 32);

  const result = await oversightLogQuery({
    actor,
    employerName: employer,
    since: isIsoDate(since) ? since : undefined,
    until: isIsoDate(until) ? until : undefined,
    limit: ROW_CAP,
  });

  const body = csvFromRows(
    [
      "at_utc",
      "kind",
      "actor",
      "subject",
      "org_name",
      "surface",
      "reason",
      "reason_note",
      "input_method",
      "org_found",
      "placement_count",
      "above_floor",
      "floor",
      "row_count",
      "k",
    ],
    result.rows.map((r) => {
      const meta = r.meta;
      const reason =
        typeof meta.reason === "string" ? meta.reason : "";
      const reasonLabel =
        reason && reason in REASON_LABELS
          ? REASON_LABELS[reason as keyof typeof REASON_LABELS]
          : reason;
      return [
        r.at,
        r.kind,
        r.actor,
        r.subject ?? "",
        r.orgName ?? "",
        typeof meta.surface === "string" ? meta.surface : "",
        reasonLabel,
        typeof meta.reasonNote === "string" ? meta.reasonNote : "",
        typeof meta.inputMethod === "string" ? meta.inputMethod : "",
        typeof meta.orgFound === "boolean" ? String(meta.orgFound) : "",
        typeof meta.placementCount === "number"
          ? meta.placementCount
          : "",
        typeof meta.aboveFloor === "boolean" ? String(meta.aboveFloor) : "",
        typeof meta.floor === "number" ? meta.floor : "",
        typeof meta.rowCount === "number" ? meta.rowCount : "",
        typeof meta.k === "number" ? meta.k : "",
      ];
    }),
  );

  await logAccess({
    kind: "analytics.export",
    actor: session.id,
    meta: {
      surface: "/admin/oversight",
      rowCount: result.rows.length,
      capped: result.rows.length === ROW_CAP,
      filterActor: actor || null,
      filterEmployer: employer || null,
      filterSince: since || null,
      filterUntil: until || null,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition("oversight"),
      "Cache-Control": "no-store",
    },
  });
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
