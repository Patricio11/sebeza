/**
 * Phase 8 — Nightly skill-gap snapshot.
 *
 * Calls the existing `captureSkillGapSnapshot()` (Phase 6.5) on a
 * schedule so the Δ deltas on `/insights` always reflect the
 * most-recent vs prior comparison. Idempotent at the row level —
 * the table just accumulates timestamped snapshots.
 */

import { NextResponse } from "next/server";
import { captureSkillGapSnapshot } from "@/db/queries/analytics";
import { isAuthorizedCron } from "@/lib/cron/auth";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await captureSkillGapSnapshot({});
    return NextResponse.json({
      ok: true,
      capturedAt: result.capturedAt,
      rowsCaptured: result.rowsCaptured,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.skill-gap-snapshot] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Snapshot failed." },
      { status: 500 },
    );
  }
}
