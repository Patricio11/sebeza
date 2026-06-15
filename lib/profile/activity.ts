/**
 * Seeker-side view of the audit log  "who saw what about me, and when".
 *
 * Reads from `audit_log` filtered to events where this seeker's profile is
 * the `subject` (e.g. an employer viewed their dossier, downloaded a doc,
 * etc.). Empty until Phase 5 wires the employer reveal + document download
 * flows that actually fire `profile.view` / `profile.contact.reveal` /
 * `profile.document.download` events with real `actor = orgId`.
 *
 * Phase 4 already writes `search.profiles` rows on every search, but those
 * aren't per-seeker  they don't have a `subject`. Those don't show up
 * here. Only events whose `subject = profile.handle` or `subject =
 * profile.id` are surfaced.
 */

import "server-only";
import { sql, and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLog, organizations } from "@/db/schema";
import type { MyProfile } from "@/lib/profile/me";

/** Event kinds the seeker activity ledger surfaces. */
const SEEKER_VISIBLE_KINDS = [
  "profile.view",
  "profile.contact.reveal",
  "profile.document.download",
  "profile.contact.request",
] as const;
type SeekerVisibleKind = (typeof SEEKER_VISIBLE_KINDS)[number];

export interface SeekerActivityKpis {
  viewers: number;
  contacts: number;
  reveals: number;
  downloads: number;
  /** "+N this week" deltas  null when the bucket didn't change. */
  viewersDelta: number | null;
  contactsDelta: number | null;
  /** Profile views in the last 7 days (a count, not a delta). */
  viewersThisWeek: number;
  /** Distinct employers (orgs) that viewed this seeker in the last 7 days. The
   *  honest "N employers viewed you this week" number  3 views by 1 org = 1. */
  distinctEmployersThisWeek: number;
}

export interface SeekerActivityItem {
  /** ISO timestamp. */
  at: string;
  kind: SeekerVisibleKind;
  /** Free-text actor label. For now: raw actor id; Phase 5 substitutes
      "<Org name> · <member name>" once the employer reveal flow writes it. */
  actor: string;
  /** Per-event detail (organization context, what was revealed, etc.). */
  detail: string;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Compute KPI deltas + recent event feed for the signed-in seeker.
 *
 * Returns zeros / empty until Phase 5 starts writing real reveal events.
 * That's correct behaviour  we never inflate the numbers with mock rows.
 */
export async function getSeekerActivity(
  profile: Pick<MyProfile, "handle" | "profileId">,
  limit = 50,
): Promise<{ kpis: SeekerActivityKpis; feed: SeekerActivityItem[] }> {
  const db = getDb();

  const subjects = [profile.handle, profile.profileId];
  const sinceLastWeek = new Date(Date.now() - ONE_WEEK_MS);
  const sincePriorWeek = new Date(Date.now() - 2 * ONE_WEEK_MS);

  // ── KPI totals (all-time, but bucketed by kind) ──────────────────────────
  const totals = await db
    .select({
      kind: auditLog.kind,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.subject, subjects),
        inArray(auditLog.kind, SEEKER_VISIBLE_KINDS as unknown as string[]),
      ),
    )
    .groupBy(auditLog.kind);

  const totalByKind = new Map<string, number>(
    totals.map((r) => [r.kind, r.count]),
  );

  // ── Last-7-day buckets for delta arrows ──────────────────────────────────
  const recent = await db
    .select({
      kind: auditLog.kind,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.subject, subjects),
        inArray(auditLog.kind, SEEKER_VISIBLE_KINDS as unknown as string[]),
        gte(auditLog.at, sinceLastWeek),
      ),
    )
    .groupBy(auditLog.kind);
  const recentByKind = new Map<string, number>(
    recent.map((r) => [r.kind, r.count]),
  );

  // 7-day "viewer" delta  count this-week vs prior-week
  const priorWeekViewers = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.subject, subjects),
        eq(auditLog.kind, "profile.view"),
        gte(auditLog.at, sincePriorWeek),
        sql`${auditLog.at} < ${sinceLastWeek}`,
      ),
    );

  const viewersThisWeek = recentByKind.get("profile.view") ?? 0;
  const priorViewers = priorWeekViewers[0]?.count ?? 0;
  const viewersDelta =
    viewersThisWeek === 0 && priorViewers === 0
      ? null
      : viewersThisWeek - priorViewers;

  // Distinct employers (orgs) that viewed this seeker in the last 7 days — the
  // honest "N employers viewed you" count (multiple views by one org = 1).
  const distinctEmployers = await db
    .select({
      n: sql<number>`COUNT(DISTINCT ${auditLog.meta} ->> 'orgId')::int`,
    })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.subject, subjects),
        eq(auditLog.kind, "profile.view"),
        gte(auditLog.at, sinceLastWeek),
        sql`${auditLog.meta} ->> 'orgId' IS NOT NULL`,
      ),
    );
  const distinctEmployersThisWeek = distinctEmployers[0]?.n ?? 0;

  const contactsThisWeek =
    (recentByKind.get("profile.contact.request") ?? 0) +
    (recentByKind.get("profile.contact.reveal") ?? 0);
  const contactsDelta = contactsThisWeek === 0 ? null : contactsThisWeek;

  // ── Recent feed ──────────────────────────────────────────────────────────
  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.subject, subjects),
        inArray(auditLog.kind, SEEKER_VISIBLE_KINDS as unknown as string[]),
      ),
    )
    .orderBy(sql`${auditLog.at} DESC`)
    .limit(limit);

  // Resolve actors to human labels. Real employer views (dossier / reveal /
  // download / contact) carry `meta.orgId` → show the org name, matching the
  // "<Org> viewed your profile" notification. Anonymous/public views show a
  // neutral label — never a raw user/org id.
  const orgIds = [
    ...new Set(
      rows
        .map((r) => (r.meta as { orgId?: string } | null)?.orgId)
        .filter((x): x is string => typeof x === "string" && x.length > 0),
    ),
  ];
  const orgNameById = new Map<string, string>();
  if (orgIds.length > 0) {
    const orgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
    for (const o of orgs) orgNameById.set(o.id, o.name);
  }

  const feed: SeekerActivityItem[] = rows.map((r) => {
    const orgId = (r.meta as { orgId?: string } | null)?.orgId ?? null;
    const actor = orgId
      ? orgNameById.get(orgId) ?? "An employer"
      : !r.actor || r.actor === "anonymous"
        ? "Anonymous visitor"
        : "An employer";
    return {
      at: r.at.toISOString(),
      kind: r.kind as SeekerVisibleKind,
      actor,
      detail: describeEvent(r.kind as SeekerVisibleKind, r.meta),
    };
  });

  return {
    kpis: {
      viewers: totalByKind.get("profile.view") ?? 0,
      contacts:
        (totalByKind.get("profile.contact.request") ?? 0) +
        (totalByKind.get("profile.contact.reveal") ?? 0),
      reveals: totalByKind.get("profile.contact.reveal") ?? 0,
      downloads: totalByKind.get("profile.document.download") ?? 0,
      viewersDelta,
      contactsDelta,
      viewersThisWeek,
      distinctEmployersThisWeek,
    },
    feed,
  };
}

function describeEvent(
  kind: SeekerVisibleKind,
  meta: unknown,
): string {
  const m = (meta ?? {}) as Record<string, unknown>;
  switch (kind) {
    case "profile.view":
      return "Viewed your public profile";
    case "profile.contact.request":
      return typeof m["context"] === "string"
        ? `Requested contact reveal · ${String(m["context"])}`
        : "Requested contact reveal";
    case "profile.contact.reveal":
      return typeof m["consentVersion"] === "string"
        ? `Contact revealed (consent v${String(m["consentVersion"])} on file)`
        : "Contact details revealed";
    case "profile.document.download":
      return typeof m["title"] === "string"
        ? `Downloaded certificate · ${String(m["title"])}`
        : "Downloaded a certificate";
  }
}
