/**
 * Phase 7  Admin user-list query + overview KPI counts.
 *
 * `listUsersQuery` replaces the hardcoded `EXTRA_USERS` array on
 * `/admin/users` with a real DB join: app_user × profiles (for seekers)
 * × organization_members + organizations (for employers). Search +
 * role + status filters all honoured.
 *
 * `adminOverviewCounts` powers the `/admin` overview KPIs.
 *
 * Lifecycle actions (suspend / restore / erase) live in
 * `lib/admin/moderation.ts`  that file is `"use server"` and groups
 * everything that mutates user state.
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, ilike, isNull, isNotNull, or, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/auth/dal";
import { signedDocumentUrl } from "@/lib/storage/signed";
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
 * Server-side loader for `/admin/users`  admin-guarded list with
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

/** The directory row plus the detail-only fields the `/admin/users/[id]` page shows. */
export interface AdminUserDetail extends AdminUserRow {
  twoFactorEnabled: boolean;
  updatedAt: string;
  suspendedAt: string | null;
  /** Resolved display name of the admin who suspended the account, if any. */
  suspendedByName: string | null;
  deletedAt: string | null;
  /** Avatar URL (Better Auth `image`); null → initials block. */
  image: string | null;
  /** Phase 8 — admin/Home-Affairs KYC verification timestamp (ISO). */
  kycVerifiedAt: string | null;
  /** Phase 11.4.4 — phone trust + per-channel opt-in. */
  phoneVerifiedAt: string | null;
  smsChannelEnabled: boolean;
  whatsappChannelEnabled: boolean;
  /** Most recent session createdAt (ISO) — a proxy for last sign-in. */
  lastSignInAt: string | null;
  /** Count of non-expired sessions (active devices). */
  activeSessions: number;
}

/**
 * Single-user loader for the in-shell admin detail page (`/admin/users/[id]`).
 * Same joins/shape as `listUsersQuery`, filtered to one id, plus a few
 * detail-only columns (2FA state, suspension when/by, timestamps). Returns
 * `null` when there's no such user so the page can `notFound()`.
 *
 * No new audit kind is logged for the *view* — it surfaces the same account
 * data the directory list already shows, and the directory list doesn't log
 * reads either; the moderation actions (suspend/restore/erase/2FA-reset) keep
 * logging via their own kinds in `lib/admin/moderation.ts`.
 */
export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  await verifyAdmin();
  const db = getDb();

  const rows = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      name: schema.appUser.name,
      role: schema.appUser.role,
      emailVerified: schema.appUser.emailVerified,
      twoFactorEnabled: schema.appUser.twoFactorEnabled,
      image: schema.appUser.image,
      kycVerifiedAt: schema.appUser.kycVerifiedAt,
      phoneVerifiedAt: schema.appUser.phoneVerifiedAt,
      smsChannelEnabled: schema.appUser.smsChannelEnabled,
      whatsappChannelEnabled: schema.appUser.whatsappChannelEnabled,
      createdAt: schema.appUser.createdAt,
      updatedAt: schema.appUser.updatedAt,
      suspendedAt: schema.appUser.suspendedAt,
      suspendedReason: schema.appUser.suspendedReason,
      suspendedByUserId: schema.appUser.suspendedByUserId,
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
    .where(eq(schema.appUser.id, userId))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  // Resolve the suspending admin's name (cheap, only when suspended).
  let suspendedByName: string | null = null;
  if (r.suspendedByUserId) {
    const actor = await db
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, r.suspendedByUserId))
      .limit(1);
    suspendedByName = actor[0]?.name ?? null;
  }

  // Sessions → last sign-in proxy + active-device count.
  const now = new Date();
  const sessions = await db
    .select({
      createdAt: schema.session.createdAt,
      expiresAt: schema.session.expiresAt,
    })
    .from(schema.session)
    .where(eq(schema.session.userId, userId))
    .orderBy(desc(schema.session.createdAt));
  const lastSignInAt = sessions[0]?.createdAt
    ? sessions[0].createdAt.toISOString()
    : null;
  const activeSessions = sessions.filter((s) => s.expiresAt > now).length;

  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role as UserRole,
    emailVerified: r.emailVerified,
    twoFactorEnabled: r.twoFactorEnabled,
    image: r.image,
    kycVerifiedAt: r.kycVerifiedAt ? r.kycVerifiedAt.toISOString() : null,
    phoneVerifiedAt: r.phoneVerifiedAt ? r.phoneVerifiedAt.toISOString() : null,
    smsChannelEnabled: r.smsChannelEnabled,
    whatsappChannelEnabled: r.whatsappChannelEnabled,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    handle: r.handle,
    profession: r.profession,
    city: r.city,
    organisation: r.organisation,
    status: r.deletedAt ? "deleted" : r.suspendedAt ? "suspended" : "active",
    suspendedReason: r.suspendedReason,
    suspendedAt: r.suspendedAt ? r.suspendedAt.toISOString() : null,
    suspendedByName,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    lastSignInAt,
    activeSessions,
  };
}

/** One POPIA consent purpose + its current state, for the detail page. */
export interface AdminConsentRow {
  purpose: string;
  state: "none" | "granted" | "revoked";
  grantedAt: string | null;
  revokedAt: string | null;
  pausedUntil: string | null;
}

/** Every consent row on file for a user (POPIA transparency on the detail page). */
export async function listConsentsForUser(
  userId: string,
): Promise<AdminConsentRow[]> {
  await verifyAdmin();
  const db = getDb();
  const rows = await db
    .select({
      purpose: schema.consents.purpose,
      state: schema.consents.state,
      grantedAt: schema.consents.grantedAt,
      revokedAt: schema.consents.revokedAt,
      pausedUntil: schema.consents.pausedUntil,
    })
    .from(schema.consents)
    .where(eq(schema.consents.userId, userId))
    .orderBy(schema.consents.purpose);
  return rows.map((r) => ({
    purpose: r.purpose,
    state: r.state as "none" | "granted" | "revoked",
    grantedAt: r.grantedAt ? r.grantedAt.toISOString() : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    pausedUntil: r.pausedUntil ? r.pausedUntil.toISOString() : null,
  }));
}

/** Seeker review bundle: the ID document + qualifications (with ids + signed
 *  document URLs) the admin needs to make verification decisions on the user
 *  detail page. All reads from the DB + Supabase Storage. */
export interface SeekerReviewBundle {
  idDoc: {
    signedUrl: string | null;
    kind: string | null;
    uploadedAt: string | null;
    rejectionReason: string | null;
  } | null;
  qualifications: Array<{
    id: string;
    title: string;
    institution: string;
    awardedYear: number | null;
    verification: "unverified" | "pending" | "verified" | "rejected";
    signedUrl: string | null;
  }>;
}

export async function getSeekerReviewBundle(
  profileId: string,
): Promise<SeekerReviewBundle> {
  await verifyAdmin();
  const db = getDb();

  const [p] = await db
    .select({
      idDocumentStorageKey: schema.profiles.idDocumentStorageKey,
      idDocumentKind: schema.profiles.idDocumentKind,
      idDocumentUploadedAt: schema.profiles.idDocumentUploadedAt,
      idDocumentRejectionReason: schema.profiles.idDocumentRejectionReason,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1);

  const quals = await db
    .select({
      id: schema.qualifications.id,
      title: schema.qualifications.title,
      institution: schema.qualifications.institution,
      awardedYear: schema.qualifications.awardedYear,
      verification: schema.qualifications.verification,
      documentStorageKey: schema.qualifications.documentStorageKey,
    })
    .from(schema.qualifications)
    .where(eq(schema.qualifications.profileId, profileId))
    .orderBy(desc(schema.qualifications.awardedYear));

  const idDoc = p?.idDocumentStorageKey
    ? {
        signedUrl: await signedDocumentUrl(p.idDocumentStorageKey),
        kind: p.idDocumentKind,
        uploadedAt: p.idDocumentUploadedAt
          ? p.idDocumentUploadedAt.toISOString()
          : null,
        rejectionReason: p.idDocumentRejectionReason,
      }
    : null;

  const qualifications = await Promise.all(
    quals.map(async (q) => ({
      id: q.id,
      title: q.title,
      institution: q.institution,
      awardedYear: q.awardedYear,
      verification: q.verification as SeekerReviewBundle["qualifications"][number]["verification"],
      signedUrl: q.documentStorageKey
        ? await signedDocumentUrl(q.documentStorageKey)
        : null,
    })),
  );

  return { idDoc, qualifications };
}

/** One uploaded organisation document with a signed view URL. */
export interface AdminOrgDocument {
  id: string;
  kind: string;
  originalName: string;
  signedUrl: string | null;
}

/** Vetting documents an org uploaded, with signed view URLs (admin only). */
export async function getOrgDocuments(
  organizationId: string,
): Promise<AdminOrgDocument[]> {
  await verifyAdmin();
  const db = getDb();
  const docs = await db
    .select({
      id: schema.organizationDocuments.id,
      kind: schema.organizationDocuments.kind,
      originalName: schema.organizationDocuments.originalName,
      storageKey: schema.organizationDocuments.storageKey,
    })
    .from(schema.organizationDocuments)
    .where(eq(schema.organizationDocuments.organizationId, organizationId))
    .orderBy(desc(schema.organizationDocuments.uploadedAt));

  return Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      kind: d.kind,
      originalName: d.originalName,
      signedUrl: await signedDocumentUrl(d.storageKey),
    })),
  );
}

/** An employer's organisation membership + the org's vetting state. */
export interface AdminEmployerContext {
  organizationId: string;
  organizationName: string;
  role: string;
  verification: "unverified" | "pending" | "verified" | "rejected";
  verifiedAt: string | null;
  rejectionReason: string | null;
  adminNote: string | null;
  joinedAt: string | null;
}

/** The org an employer belongs to + its vetting state (null for non-employers). */
export async function getEmployerContextForUser(
  userId: string,
): Promise<AdminEmployerContext | null> {
  await verifyAdmin();
  const db = getDb();
  const rows = await db
    .select({
      organizationId: schema.organizations.id,
      organizationName: schema.organizations.name,
      role: schema.organizationMembers.role,
      verification: schema.organizations.verification,
      verifiedAt: schema.organizations.verifiedAt,
      rejectionReason: schema.organizations.rejectionReason,
      adminNote: schema.organizations.adminNote,
      joinedAt: schema.organizationMembers.joinedAt,
    })
    .from(schema.organizationMembers)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.organizationMembers.organizationId),
    )
    .where(eq(schema.organizationMembers.userId, userId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    role: r.role,
    verification: r.verification as AdminEmployerContext["verification"],
    verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    rejectionReason: r.rejectionReason,
    adminNote: r.adminNote,
    joinedAt: r.joinedAt ? r.joinedAt.toISOString() : null,
  };
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

