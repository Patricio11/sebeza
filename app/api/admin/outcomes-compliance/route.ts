/**
 * Phase 7.5.6 — Admin-only smoke check that runs the outcomes-dataset
 * compliance assertions against the live DB.
 *
 *   GET /api/admin/outcomes-compliance
 *
 * Returns JSON:
 *   { ok: true,  checks: [{ name, message }, …] }
 *   { ok: false, checks: […] }   (HTTP 500 on any failure)
 *
 * Phase 11.4 will wire these same assertions into the test runner so
 * they run on every CI build. Until then this route is the manual
 * verification path.
 */

import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  assertNoCohortBelowFloor,
  assertUnconsentedNeverAppears,
  assertSeekerReportedExcluded,
  assertWorkAvailabilityPubliclySafe,
} from "@/lib/analytics/outcomes-compliance";

export async function GET() {
  await verifyAdmin();
  const checks = [
    await assertNoCohortBelowFloor(),
    await assertUnconsentedNeverAppears(),
    await assertSeekerReportedExcluded(),
    await assertWorkAvailabilityPubliclySafe(),
  ];
  const ok = checks.every((c) => c.ok);
  return NextResponse.json(
    {
      ok,
      checks: checks.map((c) => ({
        ok: c.ok,
        name: c.name,
        message: c.message,
      })),
    },
    { status: ok ? 200 : 500 },
  );
}
