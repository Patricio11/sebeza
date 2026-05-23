/**
 * Phase 9 — Nightly Sebenza LMI snapshot.
 *
 * Computes the index + writes one row to `lmi_snapshots`. The
 * /insights surface diffs the most-recent snapshot against the live
 * value to show the "(↑ 0.04 vs last week)" delta.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { lmiSnapshots } from "@/db/schema";
import { computeLmi } from "@/lib/analytics/lmi";
import { isAuthorizedCron } from "@/lib/cron/auth";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  try {
    const lmi = await computeLmi();
    const db = getDb();
    await db.insert(lmiSnapshots).values({
      id: `lmi_${randomUUID()}`,
      capturedAt: new Date(),
      value: String(lmi.value),
      freshnessRatio: String(lmi.components.freshnessRatio),
      metDemand: String(lmi.components.metDemand),
      placementVelocity: String(lmi.components.placementVelocity),
    });
    return NextResponse.json({
      ok: true,
      capturedAt: lmi.computedAt,
      lmi,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.lmi-snapshot] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Snapshot failed." },
      { status: 500 },
    );
  }
}
