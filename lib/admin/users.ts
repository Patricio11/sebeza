/**
 * Phase 7 — Admin user-list query + overview KPI counts.
 *
 * `listUsersQuery` replaces the hardcoded `EXTRA_USERS` array on
 * `/admin/users` with a real DB join: app_user × profiles (for seekers)
 * × organization_members + organizations (for employers). Search +
 * role + status filters all honoured.
 *
 * `adminOverviewCounts` powers the `/admin` overview KPIs.
 *
 * Lifecycle actions (suspend / restore / erase) live in
 * `lib/admin/moderation.ts` — that file is `"use server"` and groups
 * everything that mutates user state.
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, ilike, isNull, isNotNull, or, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/auth/dal";
import type { UserRole } from "@/lib/mock/types";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  /** Seekers only: their public handle. */
  handle: string | null;
  /** Seekers only: profession + city, useful at a glance. */
  profession: string | null;
  city: string | null;
  /** Employers only: their organisation. */
  organisation: string | null;
  /** Account state. */
  status: "active" | "suspended" | "deleted";
  suspendedReason: string | null;
}

export interface AdminUsersListOpts {
  search?: string;
  role?: UserRole | null;
  status?: "active" | "suspended" | "deleted" | null;
  limit?: number;
}

/**
 * Server-side loader for `/admin/users` — admin-guarded list with
 * search + filter. Returns a unified row shape across all roles.
 */
export async function listUsersQuery(
  opts: AdminUsersListOpts = {},
): Promise<AdminUserRow[]> {
  await verifyAdmin();
  const db = getDb();
  const search = (opts.search ?? "").trim();
  const limit = Math.min(opts.limit ?? 50, 200);

  // Build WHERE clauses. We compose them via Drizzle's and() helper.
  const conditions = [] as Array<ReturnType<typeof sql>>;
  if (search) {
    conditions.push(
      or(
        ilike(schema.appUser.email, `%${search}%`),
        ilike(schema.appUser.name, `%${search}%`),
        ilike(schema.profiles.handle, `%${search}%`),
      )!,
    );
  }
  if (opts.role) {
    conditions.push(eq(schema.appUser.role, opts.role));
  }
  if (opts.status === "suspended") {
    conditions.push(isNotNull(schema.appUser.suspendedAt));
  } else if (opts.status === "active") {
    conditions.push(isNull(schema.appUser.suspendedAt));
    conditions.push(isNull(schema.appUser.deletedAt));
  } else if (opts.status === "deleted") {
    conditions.push(isNotNull(schema.appUser.deletedAt));
  }

  const rows = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      name: schema.appUser.name,
      role: schema.appUser.role,
      emailVerified: schema.appUser.emailVerified,
      createdAt: schema.appUser.createdAt,
      suspendedAt: schema.appUser.suspendedAt,
      suspendedReason: schema.appUser.suspendedReason,
      deletedAt: schema.appUser.deletedAt,
      handle: schema.profiles.handle,
      profession: schema.profiles.profession,
      city: schema.profiles.city,
      organisation: schema.organizations.name,
    })
    .from(schema.appUser)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.appUser.id))
    .leftJoin(
      schema.organizationMembers,
      eq(schema.organizationMembers.userId, schema.appUser.id),
    )
    .leftJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.organizationMembers.organizationId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.appUser.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role as UserRole,
    emailVerified: r.emailVerified,
    createdAt: r.createdAt.toISOString(),
    handle: r.handle,
    profession: r.profession,
    city: r.city,
    organisation: r.organisation,
    status: r.deletedAt
      ? "deleted"
      : r.suspendedAt
        ? "suspended"
        : "active",
    suspendedReason: r.suspendedReason,
  }));
}

/**
 * Returns the small set of admin-dashboard headline counts. Cheap;
 * called from /admin overview.
 */
export async function adminOverviewCounts(): Promise<{
  pendingQualifications: number;
  pendingOrganisations: number;
  openReports: number;
  newUsers7d: number;
  auditEvents24h: number;
  suspendedUsers: number;
}> {
  await verifyAdmin();
  const db = getDb();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [pendingQual, pendingOrgs, openReports, newUsers, auditEvents, suspended] =
    await Promise.all([
      db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.qualifications)
        .where(eq(schema.qualifications.verification, "pending"))
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.organizations)
        .where(eq(schema.organizations.verification, "unverified"))
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.reports)
        .where(eq(schema.reports.status, "open"))
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.appUser)
        .where(sql`${schema.appUser.createdAt} >= ${since7d}`)
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.auditLog)
        .where(sql`${schema.auditLog.at} >= ${since24h}`)
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.appUser)
        .where(isNotNull(schema.appUser.suspendedAt))
        .then((r) => r[0]?.c ?? 0),
    ]);

  return {
    pendingQualifications: pendingQual,
    pendingOrganisations: pendingOrgs,
    openReports,
    newUsers7d: newUsers,
    auditEvents24h: auditEvents,
    suspendedUsers: suspended,
  };
}

