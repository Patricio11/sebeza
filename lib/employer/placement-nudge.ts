/**
 * Phase 7.5 — Lever C: contextual "Did you hire?" nudge.
 *
 * For the org currently viewing the dossier of profile X, did they
 * reveal X's contact ≥ 21 days ago (but ≤ 30 — still inside the
 * Phase-5 reveal gate) AND have they NOT logged a placement for X?
 * If yes, surface a one-tap "Did you hire?" prompt on the dossier.
 *
 * This is the chosen placement-incentive lever (Lever A — analytics
 * value-exchange — deferred to Phase 9; Lever B — verified-status
 * gating — rejected; see PHASE_7_5_PLAN.md §C.5).
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

const NUDGE_AFTER_DAYS = 21;
const REVEAL_GATE_DAYS = 30;

export interface PlacementNudgeState {
  /** True when we should surface the "Did you hire?" prompt. */
  show: boolean;
  /** Whole days since the most recent reveal (used in the copy). */
  daysSinceReveal: number;
  /** Whole days remaining in the 30-day window (used in the copy). */
  daysRemaining: number;
}

export async function placementNudgeState(
  orgId: string,
  profileId: string,
): Promise<PlacementNudgeState> {
  const db = getDb();

  // (1) Most recent `profile.contact.reveal` for this org × subject.
  const revealRows = await db
    .select({ at: schema.auditLog.at })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.kind, "profile.contact.reveal"),
        eq(schema.auditLog.subject, profileId),
        sql`${schema.auditLog.meta}->>'orgId' = ${orgId}`,
      ),
    )
    .orderBy(sql`${schema.auditLog.at} DESC`)
    .limit(1);

  const latest = revealRows[0]?.at;
  if (!latest) return { show: false, daysSinceReveal: 0, daysRemaining: 0 };

  const msSinceReveal = Date.now() - latest.getTime();
  const daysSinceReveal = Math.floor(msSinceReveal / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, REVEAL_GATE_DAYS - daysSinceReveal);

  // (2) Not yet in the late-window? Don't nudge.
  if (daysSinceReveal < NUDGE_AFTER_DAYS) {
    return { show: false, daysSinceReveal, daysRemaining };
  }
  // (3) Past the gate? Nudging would be pointless — the action is locked.
  if (daysSinceReveal > REVEAL_GATE_DAYS) {
    return { show: false, daysSinceReveal, daysRemaining };
  }

  // (4) Has this org already logged a placement for this profile?
  // (employer_confirmed OR seeker_reported — either counts as "done").
  const placementRows = await db
    .select({ id: schema.placements.id })
    .from(schema.placements)
    .where(
      and(
        eq(schema.placements.profileId, profileId),
        eq(schema.placements.organizationId, orgId),
      ),
    )
    .limit(1);

  if (placementRows.length > 0) {
    return { show: false, daysSinceReveal, daysRemaining };
  }

  return { show: true, daysSinceReveal, daysRemaining };
}
