/**
 * Phase 9.7.5  Employer self-view "Your hiring on Sebenza".
 *
 * One query, one organisation. Returns the employer's own
 * `employer_confirmed` placement mix split by `is_citizen` (the
 * 2-class derivation that Phase 9.7 uses everywhere):
 *
 *   - Total placements + SA-citizen count + foreign-national count
 *   - Per-role breakdown (top N)
 *   - Per-city breakdown (top N)
 *   - Earliest + latest hire date
 *
 * Scope: STRICTLY `organizationId = the caller's org`. No cross-
 * employer comparison, no ranking. The caller is the employer; the
 * data is their own. This is the legitimate, low-risk version of
 * the per-employer nationality view  the gated-by-default gov
 * lookup (9.7.6) is the regulated version.
 *
 * Disclosure control: the k-anonymity floor that protects everyone
 * else's data does NOT apply here  the employer already knows who
 * they hired. A k-floor on self-data would be theatre.
 *
 * Audit log: callers MUST emit `employer.own_mix.view` for symmetry,
 * even though it's self-data. Pairs with the future gov lookup audit
 * trail (9.7.7 oversight log correlates the two).
 */

import "server-only";
import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";

const TOP_N_ROLES = 10;
const TOP_N_CITIES = 10;

export interface EmployerMixBreakdownRow {
  key: string;
  total: number;
  sa_citizen: number;
  foreign_national: number;
}

export interface EmployerOwnMix {
  /** Total employer_confirmed placements ever logged for this org. */
  total: number;
  /** Of `total`, how many went to SA citizens. */
  sa_citizen: number;
  /** Of `total`, how many went to foreign nationals. */
  foreign_national: number;
  /** Top N roles by placement count, each with the same split. */
  byRole: EmployerMixBreakdownRow[];
  /** Top N cities by placement count, each with the same split. */
  byCity: EmployerMixBreakdownRow[];
  /** Earliest + latest hire date as ISO strings, null if no placements. */
  firstHireAt: string | null;
  lastHireAt: string | null;
}

export async function employerOwnMixQuery(
  orgId: string,
): Promise<EmployerOwnMix> {
  const db = getDb();

  // Single round-trip: three CTEs run in parallel at the DB, then we
  // shape them in app code. Each CTE does an INNER JOIN to profiles to
  // reach `is_citizen` (placements doesn't carry it directly  the
  // derivation must always come from the canonical source).
  const totals = (
    (await db.execute(sql`
      SELECT
        COUNT(*)::int                                        AS total,
        COUNT(*) FILTER (WHERE p.is_citizen = true)::int     AS sa_citizen,
        COUNT(*) FILTER (WHERE p.is_citizen = false)::int    AS foreign_national,
        MIN(pl.hired_at)::text                               AS first_hire_at,
        MAX(pl.hired_at)::text                               AS last_hire_at
      FROM placements pl
      INNER JOIN profiles p ON p.id = pl.profile_id
      WHERE pl.organization_id = ${orgId}
        AND pl.source = 'employer_confirmed'
        AND p.deleted_at IS NULL
    `)) as unknown as {
      rows: Array<{
        total: number;
        sa_citizen: number;
        foreign_national: number;
        first_hire_at: string | null;
        last_hire_at: string | null;
      }>;
    }
  ).rows[0]!;

  const byRoleRows = (
    (await db.execute(sql`
      SELECT
        LOWER(pl.role)                                       AS key,
        COUNT(*)::int                                        AS total,
        COUNT(*) FILTER (WHERE p.is_citizen = true)::int     AS sa_citizen,
        COUNT(*) FILTER (WHERE p.is_citizen = false)::int    AS foreign_national
      FROM placements pl
      INNER JOIN profiles p ON p.id = pl.profile_id
      WHERE pl.organization_id = ${orgId}
        AND pl.source = 'employer_confirmed'
        AND p.deleted_at IS NULL
      GROUP BY LOWER(pl.role)
      ORDER BY total DESC
      LIMIT ${TOP_N_ROLES}
    `)) as unknown as { rows: EmployerMixBreakdownRow[] }
  ).rows;

  const byCityRows = (
    (await db.execute(sql`
      SELECT
        pl.city                                              AS key,
        COUNT(*)::int                                        AS total,
        COUNT(*) FILTER (WHERE p.is_citizen = true)::int     AS sa_citizen,
        COUNT(*) FILTER (WHERE p.is_citizen = false)::int    AS foreign_national
      FROM placements pl
      INNER JOIN profiles p ON p.id = pl.profile_id
      WHERE pl.organization_id = ${orgId}
        AND pl.source = 'employer_confirmed'
        AND p.deleted_at IS NULL
      GROUP BY pl.city
      ORDER BY total DESC
      LIMIT ${TOP_N_CITIES}
    `)) as unknown as { rows: EmployerMixBreakdownRow[] }
  ).rows;

  return {
    total: totals.total,
    sa_citizen: totals.sa_citizen,
    foreign_national: totals.foreign_national,
    byRole: byRoleRows,
    byCity: byCityRows,
    firstHireAt: totals.first_hire_at
      ? new Date(totals.first_hire_at).toISOString()
      : null,
    lastHireAt: totals.last_hire_at
      ? new Date(totals.last_hire_at).toISOString()
      : null,
  };
}
