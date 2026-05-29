/**
 * Phase 9.20 Tier 3 D8  nightly placement-retention snapshot.
 *
 * For every (profession × province × milestone) cell, computes:
 *
 *   hired_in_cohort           placements hired at least N months ago
 *                              (eligible to count toward this milestone)
 *   still_active_at_milestone  of those, how many were ACTIVE at the
 *                              milestone date. A departed placement is
 *                              counted as "still active at N" iff it
 *                              left AFTER the milestone date  the
 *                              question is "did they make it to N,"
 *                              not "are they still there today."
 *
 * Per-cell suppression (k < 10) happens at the read site, not here
 * the raw aggregate is honest, the publication is filtered. Same
 * disclosure floor every Phase 9.7 LMI surface uses.
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}).
 *
 * Idempotency: the snapshot table appends a new (captured_at, cell)
 * row per run. The /insights read picks the latest capture per cell.
 * Re-runs of the cron on the same day write fresh rows; old rows stay
 * for historical comparison.
 */

import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { PROFESSIONS, PROVINCES } from "@/lib/mock/taxonomy";

/** Milestone series matches the lifecycle cadence (D2). Capped at 60
 *  months  beyond that the cohort is too thin to publish for a
 *  while yet, and we avoid burning cycles aggregating empty cells. */
const MILESTONE_MONTHS = [3, 6, 12, 24, 36, 48, 60] as const;

const SUPPRESSION_K = 10;

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.valueOf());
  out.setMonth(out.getMonth() + months);
  return out;
}

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();
  const db = getDb();

  try {
    // Pull every employer-confirmed placement with its profile's
    // canonical profession + province labels. Self-reported placements
    // are excluded (matches Phase 7.5  the softer signal doesn't
    // belong in the official retention figure).
    const rows = await db
      .select({
        id: schema.placements.id,
        hiredAt: schema.placements.hiredAt,
        currentStatus: schema.placements.currentStatus,
        departureDate: schema.placements.departureDate,
        profession: schema.profiles.profession,
        province: schema.profiles.province,
      })
      .from(schema.placements)
      .innerJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.placements.profileId),
      )
      .where(eq(schema.placements.source, "employer_confirmed"));

    // Build reverse-lookup maps: profile-stored label  taxonomy slug.
    // Case-insensitive on the label so casing drift doesn't drop rows.
    const provinceLookup = new Map(
      PROVINCES.map((p) => [p.label.toLowerCase(), p.slug]),
    );
    const professionLookup = new Map(
      PROFESSIONS.map((p) => [p.label.toLowerCase(), p.slug]),
    );

    interface CellCounts {
      hiredInCohort: number;
      stillActiveAtMilestone: number;
    }
    // Keyed `${professionSlug}|${provinceSlug}|${milestoneMonths}`.
    const cells = new Map<string, CellCounts>();
    function bumpCell(
      professionSlug: string,
      provinceSlug: string,
      milestoneMonths: number,
      hired: boolean,
      stillActive: boolean,
    ) {
      const key = `${professionSlug}|${provinceSlug}|${milestoneMonths}`;
      const c = cells.get(key) ?? {
        hiredInCohort: 0,
        stillActiveAtMilestone: 0,
      };
      if (hired) c.hiredInCohort++;
      if (stillActive) c.stillActiveAtMilestone++;
      cells.set(key, c);
    }

    for (const row of rows) {
      const provinceSlug = provinceLookup.get(row.province.toLowerCase());
      const professionSlug = professionLookup.get(
        row.profession.toLowerCase(),
      );
      // Without a slug we can't bucket cleanly; skip rather than
      // smuggling an unmapped row into a "none" cell.
      if (!provinceSlug || !professionSlug) continue;

      const hiredAt =
        row.hiredAt instanceof Date ? row.hiredAt : new Date(row.hiredAt);
      const departureDate = row.departureDate
        ? new Date(row.departureDate)
        : null;

      for (const months of MILESTONE_MONTHS) {
        const milestoneDate = addMonths(hiredAt, months);
        // Not in cohort: the placement hasn't reached this milestone
        // by the capture date.
        if (milestoneDate.getTime() > ranAt.getTime()) continue;

        let stillActive: boolean;
        if (row.currentStatus === "active") {
          stillActive = true;
        } else if (row.currentStatus === "unknown") {
          // Conservative posture (same as years-experience: unknown
          // is not a pass).
          stillActive = false;
        } else if (row.currentStatus === "departed") {
          // Made it to the milestone iff they departed AFTER it.
          stillActive =
            departureDate !== null &&
            departureDate.getTime() >= milestoneDate.getTime();
        } else {
          stillActive = false;
        }

        bumpCell(professionSlug, provinceSlug, months, true, stillActive);
      }
    }

    // Filter to k-thresholded cells + write a snapshot row per cell.
    let written = 0;
    let suppressed = 0;
    for (const [key, counts] of cells) {
      if (counts.hiredInCohort < SUPPRESSION_K) {
        suppressed++;
        continue;
      }
      const [professionSlug, provinceSlug, milestoneStr] = key.split("|");
      if (!professionSlug || !provinceSlug || !milestoneStr) continue;
      await db.insert(schema.placementRetentionSnapshots).values({
        id: `prs_${randomUUID()}`,
        capturedAt: ranAt,
        professionSlug,
        provinceSlug,
        milestoneMonths: Number(milestoneStr),
        hiredInCohort: counts.hiredInCohort,
        stillActiveAtMilestone: counts.stillActiveAtMilestone,
      });
      written++;
    }

    return NextResponse.json({
      ok: true,
      ranAt: ranAt.toISOString(),
      placementsScanned: rows.length,
      cellsEvaluated: cells.size,
      cellsWritten: written,
      cellsSuppressed: suppressed,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.placement-retention-snapshot] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Cron failed.",
      },
      { status: 500 },
    );
  }
}
