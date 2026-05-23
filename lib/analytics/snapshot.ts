"use server";

/**
 * Admin-callable Server Action to capture a skills-gap snapshot.
 *
 * The Phase 8 cron will own this in production. Until then it's
 * triggerable manually from the Phase 7 admin surface, or from a
 * one-shot script during a deploy.
 *
 * Verified-admin-only — capture writes an audit row tagged with the
 * acting admin so it's clear who initiated each manual snapshot.
 */

import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { captureSkillGapSnapshot } from "@/db/queries/analytics";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export async function captureSnapshotAction(opts?: {
  province?: string | null;
  top?: number;
}): Promise<ActionResult<{ rowsCaptured: number; capturedAt: string }>> {
  const session = await verifyAdmin();
  try {
    const result = await captureSkillGapSnapshot(opts ?? {});

    await logAccess({
      kind: "analytics.export",
      actor: session.id,
      meta: {
        scope: "skill_gap_snapshot",
        rowCount: result.rowsCaptured,
        capturedAt: result.capturedAt,
        province: opts?.province ?? null,
      },
    });

    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Snapshot capture failed.",
    };
  }
}
