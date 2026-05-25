/**
 * Phase 7.5.6  Admin-only smoke check that runs the outcomes-dataset
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
  assertNoNationalityCellBelowFloor,
  assertNoRawCountryInAnalytics,
  // Phase 9.8.8  vacancy / invitation compliance
  assertNoVacancyFieldOnPublicSurfaces,
  assertInviteRequiresConsent,
  assertNoNationalityInviteGate,
  assertNoDeclineReasonCellBelowFloor,
  assertAcceptWithNoticeNotInUnfilled,
  assertDeclineNoteFlaggedPII,
  // Phase 9.12  learning-loop compliance
  assertSelfAttestedNeverVerified,
  assertLearningItemsSeekerPrivate,
  assertLearningNudgeCapHonoured,
  // Phase 9.13  learning-loop intelligence compliance
  assertCurriculumCellsAboveFloor,
  assertStallCellsAboveFloor,
  assertStallConsentGateEnforced,
} from "@/lib/analytics/outcomes-compliance";

export async function GET() {
  await verifyAdmin();
  const checks = [
    await assertNoCohortBelowFloor(),
    await assertUnconsentedNeverAppears(),
    await assertSeekerReportedExcluded(),
    await assertWorkAvailabilityPubliclySafe(),
    await assertNoNationalityCellBelowFloor(),
    await assertNoRawCountryInAnalytics(),
    // Phase 9.8.8
    await assertNoVacancyFieldOnPublicSurfaces(),
    await assertInviteRequiresConsent(),
    await assertNoNationalityInviteGate(),
    await assertNoDeclineReasonCellBelowFloor(),
    await assertAcceptWithNoticeNotInUnfilled(),
    await assertDeclineNoteFlaggedPII(),
    // Phase 9.12
    await assertSelfAttestedNeverVerified(),
    await assertLearningItemsSeekerPrivate(),
    await assertLearningNudgeCapHonoured(),
    // Phase 9.13
    await assertCurriculumCellsAboveFloor(),
    await assertStallCellsAboveFloor(),
    await assertStallConsentGateEnforced(),
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
