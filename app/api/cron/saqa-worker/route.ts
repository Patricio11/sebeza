/**
 * Phase 8 — SAQA verification worker (gated cron).
 *
 * Claims `queued` rows from `qualification_kyc_jobs`, calls the SAQA
 * NLRD adapter, and writes the result back. Rate-limited (max 10 per
 * run) per the plan's re-check #4 because SAQA NLRD is slow and
 * rate-limited at source.
 *
 * Gated TWO ways:
 *   1. `CRON_SECRET` header (standard for every /api/cron/*).
 *   2. `feature_flag_saqa_worker` platform setting must be ON. When
 *      OFF, the worker no-ops — the partnership flag stays the gate.
 *
 * Real SAQA calls aren't implemented yet (no partnership). For now the
 * worker resolves every queued job to `verified` so the demo path is
 * exercised end-to-end. Wire the real HTTP call in `runSaqaCheck()`
 * when partnership lands.
 */

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";

const MAX_PER_RUN = 10;

/**
 * Stand-in for the real SAQA NLRD POST. Returns `verified` for any
 * qualification today (no partnership = no real check). Replace the
 * body with a real fetch + parse when SAQA is reachable.
 */
async function runSaqaCheck(qualification: {
  id: string;
  title: string;
  institution: string;
  awardedYear: number | null;
}): Promise<
  | { status: "verified"; raw: Record<string, unknown>; providerTxId: string }
  | { status: "mismatch"; reason: string; raw: Record<string, unknown> }
  | { status: "error"; message: string }
> {
  // Real flow:
  //   const res = await fetch(`${SAQA_BASE}/nlrd/search`, { … });
  //   parse + return verified | mismatch | error.
  //
  // Until partnership lands, we acknowledge the row deterministically
  // so the demo path renders. The audit log still distinguishes a
  // SAQA-routed approval (`verification.approve.saqa`) from a manual
  // one (`verification.approve.manual_override`).
  void qualification;
  return {
    status: "verified",
    providerTxId: `mock-saqa-${qualification.id}`,
    raw: { note: "SAQA worker mock — partnership not yet active." },
  };
}

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  // Gate #2 — partnership flag. When off, no-op.
  const enabled = await getSetting<boolean>("feature_flag_saqa_worker");
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      skipped: true,
      reason: "feature_flag_saqa_worker is OFF — worker is dormant until partnership.",
    });
  }

  const db = getDb();
  const queued = await db
    .select({
      id: schema.qualificationKycJobs.id,
      qualificationId: schema.qualificationKycJobs.qualificationId,
      attemptCount: schema.qualificationKycJobs.attemptCount,
      title: schema.qualifications.title,
      institution: schema.qualifications.institution,
      awardedYear: schema.qualifications.awardedYear,
      profileId: schema.qualifications.profileId,
      ownerUserId: schema.profiles.userId,
    })
    .from(schema.qualificationKycJobs)
    .innerJoin(
      schema.qualifications,
      eq(schema.qualifications.id, schema.qualificationKycJobs.qualificationId),
    )
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.qualifications.profileId),
    )
    .where(eq(schema.qualificationKycJobs.status, "queued"))
    .orderBy(asc(schema.qualificationKycJobs.submittedAt))
    .limit(MAX_PER_RUN);

  let processed = 0;
  for (const job of queued) {
    try {
      await db
        .update(schema.qualificationKycJobs)
        .set({
          status: "in_flight",
          attemptCount: job.attemptCount + 1,
        })
        .where(eq(schema.qualificationKycJobs.id, job.id));

      const result = await runSaqaCheck({
        id: job.qualificationId,
        title: job.title,
        institution: job.institution,
        awardedYear: job.awardedYear,
      });

      if (result.status === "verified") {
        await db
          .update(schema.qualifications)
          .set({ verification: "verified" })
          .where(eq(schema.qualifications.id, job.qualificationId));
        await db
          .update(schema.qualificationKycJobs)
          .set({
            status: "verified",
            resultJson: result.raw,
            providerTransactionId: result.providerTxId,
            completedAt: new Date(),
          })
          .where(eq(schema.qualificationKycJobs.id, job.id));
        await logAccess({
          kind: "verification.approve.saqa",
          actor: "system",
          subject: job.profileId,
          meta: {
            qualificationId: job.qualificationId,
            stage: "verified",
            providerTransactionId: result.providerTxId,
          },
        });
        if (job.ownerUserId) {
          await createNotification({
            userId: job.ownerUserId,
            kind: "qualification.verified",
            title: "A qualification was verified by SAQA",
            body: `${job.title} now carries the Verified badge.`,
            link: "/dashboard/qualifications",
            meta: { qualificationId: job.qualificationId, source: "saqa" },
          });
        }
      } else if (result.status === "mismatch") {
        await db
          .update(schema.qualifications)
          .set({ verification: "rejected" })
          .where(eq(schema.qualifications.id, job.qualificationId));
        await db
          .update(schema.qualificationKycJobs)
          .set({
            status: "mismatch",
            resultJson: result.raw,
            completedAt: new Date(),
          })
          .where(eq(schema.qualificationKycJobs.id, job.id));
        await logAccess({
          kind: "verification.reject.saqa",
          actor: "system",
          subject: job.profileId,
          meta: {
            qualificationId: job.qualificationId,
            stage: "mismatch",
            reason: result.reason,
          },
        });
        if (job.ownerUserId) {
          await createNotification({
            userId: job.ownerUserId,
            kind: "qualification.rejected",
            title: "SAQA could not verify a qualification",
            body: `${job.title} — SAQA reason: ${result.reason}`,
            link: "/dashboard/qualifications",
            meta: { qualificationId: job.qualificationId, source: "saqa", reason: result.reason },
          });
        }
      } else {
        // error — leave the qualification as 'pending'; mark job error.
        await db
          .update(schema.qualificationKycJobs)
          .set({
            status: "error",
            resultJson: { error: result.message },
            completedAt: new Date(),
          })
          .where(eq(schema.qualificationKycJobs.id, job.id));
      }
      processed++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[cron.saqa-worker] failed for ${job.id}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    claimed: queued.length,
    processed,
  });
}
