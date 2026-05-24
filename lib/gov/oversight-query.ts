/**
 * Phase 9.7.7  Sensitive-query oversight log query.
 *
 * Surfaces every audit-log row that records a sensitive nationality
 * query  the two surfaces are:
 *
 *   1. `kind = 'gov.employer_mix.lookup'` (9.7.6  every call, found
 *      or not, above or below floor).
 *   2. `kind = 'analytics.export'` AND `meta->>'surface'` is one of
 *      the nationality-related surfaces (`/gov/nationality-mix`,
 *      `/gov/shortage-justification`).
 *
 * Filters: actor (substring on actor OR subject), employer (subject
 * exact-match against an organisation id), date range (since / until).
 *
 * Trust rationale (PHASE_9_7_PLAN.md, "WHY THIS IS THE SEBENZA
 * VERSION"): giving `gov` a powerful lens is safe *because* its use
 * is itself observable. This query is the observability.
 */

import "server-only";
import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLog, organizations } from "@/db/schema";
import type { AuditKind } from "@/lib/audit";

/**
 * The nationality-related `analytics.export` surfaces. If a future
 * task adds a new nationality export, add the surface tag here so
 * the oversight log catches it automatically.
 */
export const NATIONALITY_EXPORT_SURFACES = [
  "/gov/nationality-mix",
  "/gov/shortage-justification",
] as const;

export const OVERSIGHT_KINDS_INCLUDED = [
  "gov.employer_mix.lookup",
  "analytics.export",
] as const satisfies readonly AuditKind[];

export interface OversightQueryOpts {
  /** Substring match against actor OR subject. */
  actor?: string;
  /**
   * When set, narrow to rows whose subject is the orgId of the named
   * organisation (case-folded equality match against organizations.name).
   * Returns the resolved orgId so the page can render it back.
   */
  employerName?: string;
  /** ISO date string  inclusive lower bound on `at`. */
  since?: string;
  /** ISO date string  exclusive upper bound on `at`. */
  until?: string;
  limit?: number;
}

export interface OversightRow {
  id: string;
  at: string;
  kind: AuditKind;
  actor: string;
  subject: string | null;
  meta: Record<string, unknown>;
  /** Resolved organisation name if `subject` matches an org id, else null. */
  orgName: string | null;
}

export interface OversightSummary {
  /** Total rows visible after filters (capped at `limit`). */
  total: number;
  /** Of `total`, gov.employer_mix.lookup rows. */
  lookups: number;
  /** Of lookups, how many returned a found-and-above-floor result. */
  lookupsAboveFloor: number;
  /** Of lookups, found but below the small-numbers floor. */
  lookupsBelowFloor: number;
  /** Of lookups, the named org was not found. */
  lookupsOrgNotFound: number;
  /** Of `total`, nationality-related analytics.export rows. */
  exports: number;
  /** Most recent row's `at` (ISO), if any. */
  latestAt: string | null;
}

export interface OversightQueryResult {
  rows: OversightRow[];
  summary: OversightSummary;
  /** When `employerName` was provided, the resolved org id used for filtering. */
  resolvedOrgId: string | null;
  /** When `employerName` was provided but no org matched, true. */
  employerNotFound: boolean;
}

export async function oversightLogQuery(
  opts: OversightQueryOpts = {},
): Promise<OversightQueryResult> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 200, 10_000);

  // Resolve employer name to org id up front (single round-trip vs a
  // JOIN-with-filter in the main query; keeps the where clause
  // readable). Case-folded exact match  same idiom as 9.7.6.
  let resolvedOrgId: string | null = null;
  let employerNotFound = false;
  if (opts.employerName?.trim()) {
    const orgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(ilike(organizations.name, opts.employerName.trim()))
      .limit(1);
    if (orgs[0]) {
      resolvedOrgId = orgs[0].id;
    } else {
      employerNotFound = true;
    }
  }

  // The two-surface OR clause: lookup rows are always included; export
  // rows only when the meta.surface is in the nationality list.
  const surfacesSql = sql`(${sql.join(
    NATIONALITY_EXPORT_SURFACES.map((s) => sql`${s}`),
    sql`, `,
  )})`;
  const kindOrSurface = or(
    eq(auditLog.kind, "gov.employer_mix.lookup"),
    and(
      eq(auditLog.kind, "analytics.export"),
      sql`(${auditLog.meta}->>'surface') IN ${surfacesSql}`,
    ),
  )!;

  const where = [kindOrSurface] as Array<ReturnType<typeof sql>>;

  const trimmedActor = opts.actor?.trim();
  if (trimmedActor) {
    where.push(
      or(
        ilike(auditLog.actor, `%${trimmedActor}%`),
        ilike(auditLog.subject, `%${trimmedActor}%`),
      )!,
    );
  }
  if (resolvedOrgId) {
    where.push(eq(auditLog.subject, resolvedOrgId));
  }
  // employerNotFound  return zero rows; cheap path.
  if (employerNotFound) {
    return {
      rows: [],
      summary: emptySummary(),
      resolvedOrgId: null,
      employerNotFound: true,
    };
  }
  if (opts.since) {
    where.push(gte(auditLog.at, new Date(opts.since)));
  }
  if (opts.until) {
    where.push(lt(auditLog.at, new Date(opts.until)));
  }

  const raw = await db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      kind: auditLog.kind,
      actor: auditLog.actor,
      subject: auditLog.subject,
      meta: auditLog.meta,
      orgName: organizations.name,
    })
    .from(auditLog)
    .leftJoin(organizations, eq(organizations.id, auditLog.subject))
    .where(and(...where))
    .orderBy(desc(auditLog.at))
    .limit(limit);

  const rows: OversightRow[] = raw.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    kind: r.kind as AuditKind,
    actor: r.actor,
    subject: r.subject ?? null,
    meta: (r.meta as Record<string, unknown>) ?? {},
    orgName: r.orgName ?? null,
  }));

  return {
    rows,
    summary: summarise(rows),
    resolvedOrgId,
    employerNotFound: false,
  };
}

function emptySummary(): OversightSummary {
  return {
    total: 0,
    lookups: 0,
    lookupsAboveFloor: 0,
    lookupsBelowFloor: 0,
    lookupsOrgNotFound: 0,
    exports: 0,
    latestAt: null,
  };
}

function summarise(rows: OversightRow[]): OversightSummary {
  const s = emptySummary();
  s.total = rows.length;
  if (rows.length === 0) return s;
  s.latestAt = rows[0]!.at;
  for (const r of rows) {
    if (r.kind === "gov.employer_mix.lookup") {
      s.lookups++;
      const meta = r.meta;
      const orgFound = meta.orgFound === true;
      const aboveFloor = meta.aboveFloor === true;
      if (!orgFound) s.lookupsOrgNotFound++;
      else if (aboveFloor) s.lookupsAboveFloor++;
      else s.lookupsBelowFloor++;
    } else if (r.kind === "analytics.export") {
      s.exports++;
    }
  }
  return s;
}
