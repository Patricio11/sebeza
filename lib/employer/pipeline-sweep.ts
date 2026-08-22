/**
 * G11  the stalled-pipeline sweep.
 *
 * Every other employer notification in this product is per-seeker and
 * per-event: someone accepted, someone declined, someone let an invite
 * expire. Nothing ever steps back and says "this vacancy is not
 * working". A recruiter whose pipeline has quietly run dry finds out by
 * happening to look.
 *
 * NOT a `"use server"` module, deliberately (same reasoning as
 * invitations-cron.ts): nothing here should be reachable as a Server
 * Action. The cron route is the only caller.
 *
 * When it fires
 * -------------
 * All four must hold:
 *   1. the vacancy is `open`;
 *   2. it declared a headcount (`positions`), because without a target
 *      there is no such thing as short;
 *   3. it is still short, counting placements when any exist and
 *      acceptances otherwise (see vacancy-fill.ts);
 *   4. NOBODY is pending.
 *
 * Condition 4 is what keeps this from being a nag. While even one
 * invitation is outstanding the recruiter is waiting on a person, not
 * stuck, and a notification would just be noise. The catalog's 7-day
 * dedupe window does the rest.
 */

import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { notifyOrgMembers } from "@/lib/notifications/server";
import { logAccess } from "@/lib/audit";
import { fillState } from "./vacancy-fill";

export interface SweepResult {
  scanned: number;
  fired: number;
}

/** One pass over every open vacancy that declared a headcount. */
export async function sweepStalledPipelines(): Promise<SweepResult> {
  const db = getDb();

  const vacancies = await db
    .select({
      id: schema.vacancies.id,
      title: schema.vacancies.title,
      organizationId: schema.vacancies.organizationId,
      positions: schema.vacancies.positions,
    })
    .from(schema.vacancies)
    .where(eq(schema.vacancies.status, "open"));

  // Only vacancies that told us what they need.
  const candidates = vacancies.filter(
    (v) => v.positions != null && v.positions > 0,
  );
  if (candidates.length === 0) return { scanned: 0, fired: 0 };

  const ids = candidates.map((v) => v.id);

  const invitations = await db
    .select({
      vacancyId: schema.vacancyInvitations.vacancyId,
      state: schema.vacancyInvitations.state,
    })
    .from(schema.vacancyInvitations)
    .where(inArray(schema.vacancyInvitations.vacancyId, ids));

  const placements = await db
    .select({ vacancyId: schema.placements.vacancyId })
    .from(schema.placements)
    .where(inArray(schema.placements.vacancyId, ids));

  const byVacancy = new Map<
    string,
    { accepted: number; pending: number; placements: number }
  >();
  for (const id of ids) {
    byVacancy.set(id, { accepted: 0, pending: 0, placements: 0 });
  }
  for (const inv of invitations) {
    const row = byVacancy.get(inv.vacancyId);
    if (!row) continue;
    if (inv.state === "accepted" || inv.state === "accepted_with_notice") {
      row.accepted++;
    } else if (inv.state === "invited" || inv.state === "offer_made") {
      // An outstanding counter-offer is someone still deciding: the
      // recruiter is waiting on a person, not stuck.
      row.pending++;
    }
  }
  for (const p of placements) {
    if (!p.vacancyId) continue;
    const row = byVacancy.get(p.vacancyId);
    if (row) row.placements++;
  }

  let fired = 0;
  for (const v of candidates) {
    const counts = byVacancy.get(v.id);
    if (!counts) continue;
    // Someone is still deciding: not stuck, so not our business.
    if (counts.pending > 0) continue;

    const fill = fillState({
      positions: v.positions,
      acceptedCount: counts.accepted,
      placementCount: counts.placements,
    });
    if (!fill.isShort) continue;

    try {
      await notifyOrgMembers(v.organizationId, {
        kind: "vacancy.pipeline.stalled",
        title: `"${v.title}" still needs ${fill.remaining} ${fill.remaining === 1 ? "person" : "people"}`,
        body:
          `Everyone you invited has answered, and nobody is left pending. ` +
          `Open the vacancy to invite more candidates, or mark it filled if you have sorted it out elsewhere.`,
        link: `/employer/vacancies/${v.id}`,
        // One per vacancy inside the catalog's 7-day window, so a
        // recruiter with six stuck vacancies hears about six, not one.
        dedupeKey: v.id,
      });
      await logAccess({
        kind: "vacancy.pipeline.stalled",
        actor: "cron:pipeline-sweep",
        subject: v.id,
        meta: {
          orgId: v.organizationId,
          remaining: fill.remaining,
          filled: fill.filled,
          basis: fill.basis,
        },
      });
      fired++;
    } catch (e) {
      // One bad vacancy must not stop the sweep.
      // eslint-disable-next-line no-console
      console.error("[pipeline-sweep] failed for", v.id, e);
    }
  }

  return { scanned: candidates.length, fired };
}
