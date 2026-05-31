/**
 * Phase 11.4.5  recommended-employers leaderboard query.
 *
 * Aggregates `placement.confirm` audit rows by org_id, scoped to a
 * profession + province. Ranked by confirmed-placement count
 * descending. Suppression: orgs with fewer than the
 * `employer_mix_min_placements` floor (default 5, can be raised) are
 * excluded  matches the gov suppression posture (D4).
 *
 * Privacy invariant: this aggregate never leaks seeker-level data.
 * Org-level counts only. Search-side ranking has NO paid placement
 * tier (D-from-plan)  the leaderboard is purely data-driven.
 */

import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";

export interface EmployerLeaderboardRow {
  orgId: string;
  orgName: string;
  orgVerification: "unverified" | "pending" | "verified" | "rejected";
  /** Number of CONFIRMED placements (employer-side, not seeker self-
   *  report) in the (profession × province) cell across all time. */
  confirmedPlacements: number;
  /** Number of currently-open vacancies for the org (any pool, not
   *  just this profession × province). Read-side context for the
   *  card; not part of the ranking. */
  openVacancyCount: number;
}

export interface TopEmployersInput {
  profession: string;
  province: string;
  limit?: number;
}

export async function topEmployersByProfessionProvince(
  input: TopEmployersInput,
): Promise<EmployerLeaderboardRow[]> {
  const floor = await getSetting<number>("employer_mix_min_placements");
  const db = getDb();
  const limit = Math.min(input.limit ?? 10, 50);

  // Aggregate placements via `placements` table  the canonical
  // record of every confirmed hire. Joins to organizations + profiles
  // so the WHERE clause can filter by profession + province as labels
  // on the seeker side (the placement row carries the seeker's
  // profile_id; we match the seeker's profession + province).
  const rows = await db
    .select({
      orgId: schema.organizations.id,
      orgName: schema.organizations.name,
      orgVerification: schema.organizations.verification,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(schema.placements)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.placements.organizationId),
    )
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.placements.profileId),
    )
    .where(
      and(
        // Placement-Truth Rule: employer-confirmed only.
        // `placements.source` carries the distinction since Phase 7.5;
        // seeker-self-report rows are excluded from official figures
        // including this leaderboard.
        eq(schema.placements.source, "employer_confirmed"),
        sql`LOWER(${schema.profiles.profession}) = LOWER(${input.profession})`,
        sql`LOWER(${schema.profiles.province}) = LOWER(${input.province})`,
      ),
    )
    .groupBy(
      schema.organizations.id,
      schema.organizations.name,
      schema.organizations.verification,
    )
    .orderBy(desc(sql<number>`COUNT(*)`))
    .limit(limit);

  // Apply the suppression floor + look up open-vacancy counts in a
  // small per-row follow-up. N is capped at `limit` (default 10),
  // so the round-trip cost is negligible.
  const out: EmployerLeaderboardRow[] = [];
  for (const r of rows) {
    if (r.count < floor) continue;
    const openRows = await db
      .select({ id: schema.vacancies.id })
      .from(schema.vacancies)
      .where(
        and(
          eq(schema.vacancies.organizationId, r.orgId),
          eq(schema.vacancies.status, "open"),
        ),
      );
    out.push({
      orgId: r.orgId,
      orgName: r.orgName,
      orgVerification:
        r.orgVerification as EmployerLeaderboardRow["orgVerification"],
      confirmedPlacements: r.count,
      openVacancyCount: openRows.length,
    });
  }
  return out;
}
