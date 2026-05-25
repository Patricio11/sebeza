"use server";

/**
 * Phase 9.10  Admin org-vetting actions + reads.
 *
 * This file adds the new actions on top of the existing
 * `lib/admin/verifications.ts` (which has approve/reject from
 * Phase 7). The Phase 9.10 additions:
 *
 *   - approveOrg            : approves + stamps verifiedAt /
 *                              verifiedByUserId + clears stale
 *                              rejection / admin-note + fires the
 *                              org.verified notification. Replaces
 *                              the old `approveOrganisation` for
 *                              new code paths; the legacy action
 *                              stays as-is for backwards compat.
 *   - rejectOrg             : flips to rejected + stamps
 *                              rejectionReason (was on a separate
 *                              schema column only in Phase 9.10).
 *   - requestChangesOnOrg   : "soft reject"  flips back to
 *                              unverified, stamps adminNote, fires
 *                              org.review.changes notification. The
 *                              user lands on the onboarding form
 *                              with a yellow banner.
 *   - resendOrgVerificationEmail : break-glass for the Owner's
 *                              email-verification link.
 *   - markOrgEmailVerified  : break-glass that flips the Owner's
 *                              emailVerified flag (e.g. Outlook
 *                              Safe Links pre-consumed the token).
 *                              Does NOT auto-sign-in the user.
 *
 * Reads:
 *   - listOrgsForReview     : richer query than the Phase 7
 *                              `listPendingOrganisations`  joins
 *                              to organization_documents for the
 *                              admin queue, includes Owner email
 *                              for the resend action.
 *   - getOrgReviewDetail    : full review-modal payload  org row
 *                              + Owner user row + all docs with
 *                              signed download URLs.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth as betterAuth } from "@/lib/auth/server";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification, notifyOrgMembers } from "@/lib/notifications/server";
import { signedDocumentUrl } from "@/lib/storage/signed";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export interface OrgReviewRow {
  id: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  companyAddress: string | null;
  vatNumber: string | null;
  verification: "unverified" | "pending" | "verified" | "rejected";
  rejectionReason: string | null;
  adminNote: string | null;
  createdAt: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerEmailVerified: boolean;
  documentCount: number;
}

/**
 * Lists organisations in any of the lifecycle states. Returns
 * counts + a doc count per org so the admin queue can show the
 * "pending review" tab with a badge. The Owner's user row is
 * joined for the email-verified flag + the resend-verification
 * action.
 */
export async function listOrgsForReview(): Promise<{
  pending: OrgReviewRow[];
  unverified: OrgReviewRow[];
  rejected: OrgReviewRow[];
  verified: OrgReviewRow[];
}> {
  await verifyAdmin();
  const db = getDb();

  const orgRows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      registrationNumber: schema.organizations.registrationNumber,
      industry: schema.organizations.industry,
      country: schema.organizations.country,
      city: schema.organizations.city,
      companyAddress: schema.organizations.companyAddress,
      vatNumber: schema.organizations.vatNumber,
      verification: schema.organizations.verification,
      rejectionReason: schema.organizations.rejectionReason,
      adminNote: schema.organizations.adminNote,
      createdAt: schema.organizations.createdAt,
    })
    .from(schema.organizations)
    .orderBy(desc(schema.organizations.createdAt))
    .limit(500);

  if (orgRows.length === 0) {
    return { pending: [], unverified: [], rejected: [], verified: [] };
  }

  const orgIds = orgRows.map((r) => r.id);

  // Owner per org (orgMember.role = 'owner', not suspended).
  const owners = await db
    .select({
      organizationId: schema.organizationMembers.organizationId,
      userId: schema.organizationMembers.userId,
      name: schema.appUser.name,
      email: schema.appUser.email,
      emailVerified: schema.appUser.emailVerified,
    })
    .from(schema.organizationMembers)
    .innerJoin(
      schema.appUser,
      eq(schema.appUser.id, schema.organizationMembers.userId),
    )
    .where(
      and(
        inArray(schema.organizationMembers.organizationId, orgIds),
        eq(schema.organizationMembers.role, "owner"),
        isNull(schema.organizationMembers.suspendedAt),
      ),
    );
  const ownerByOrg = new Map(owners.map((o) => [o.organizationId, o]));

  // Doc count per org.
  const counts = await db
    .select({
      organizationId: schema.organizationDocuments.organizationId,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(schema.organizationDocuments)
    .where(inArray(schema.organizationDocuments.organizationId, orgIds))
    .groupBy(schema.organizationDocuments.organizationId);
  const docCountByOrg = new Map(counts.map((c) => [c.organizationId, c.n]));

  const all: OrgReviewRow[] = orgRows.map((r) => {
    const owner = ownerByOrg.get(r.id);
    return {
      id: r.id,
      name: r.name,
      registrationNumber: r.registrationNumber,
      industry: r.industry,
      country: r.country,
      city: r.city,
      companyAddress: r.companyAddress,
      vatNumber: r.vatNumber,
      verification: r.verification as OrgReviewRow["verification"],
      rejectionReason: r.rejectionReason,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      ownerUserId: owner?.userId ?? null,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      ownerEmailVerified: owner?.emailVerified ?? false,
      documentCount: docCountByOrg.get(r.id) ?? 0,
    };
  });

  return {
    pending: all.filter((o) => o.verification === "pending"),
    unverified: all.filter((o) => o.verification === "unverified"),
    rejected: all.filter((o) => o.verification === "rejected"),
    verified: all.filter((o) => o.verification === "verified"),
  };
}

export interface OrgReviewDocument {
  id: string;
  kind: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  signedUrl: string | null;
}

export interface OrgReviewDetail {
  org: OrgReviewRow;
  documents: OrgReviewDocument[];
}

export async function getOrgReviewDetail(
  orgId: string,
): Promise<OrgReviewDetail | null> {
  await verifyAdmin();
  const db = getDb();

  const orgs = await listOrgsForReview();
  const all = [
    ...orgs.pending,
    ...orgs.unverified,
    ...orgs.rejected,
    ...orgs.verified,
  ];
  const org = all.find((o) => o.id === orgId);
  if (!org) return null;

  const docRows = await db
    .select({
      id: schema.organizationDocuments.id,
      kind: schema.organizationDocuments.kind,
      originalName: schema.organizationDocuments.originalName,
      storageKey: schema.organizationDocuments.storageKey,
      mimeType: schema.organizationDocuments.mimeType,
      sizeBytes: schema.organizationDocuments.sizeBytes,
      uploadedAt: schema.organizationDocuments.uploadedAt,
    })
    .from(schema.organizationDocuments)
    .where(eq(schema.organizationDocuments.organizationId, orgId))
    .orderBy(desc(schema.organizationDocuments.uploadedAt));

  // Sign each storage key for inline preview / download.
  const documents: OrgReviewDocument[] = [];
  for (const d of docRows) {
    let signedUrl: string | null = null;
    try {
      signedUrl = await signedDocumentUrl(d.storageKey);
    } catch {
      signedUrl = null;
    }
    documents.push({
      id: d.id,
      kind: d.kind,
      originalName: d.originalName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt.toISOString(),
      signedUrl,
    });
  }

  return { org, documents };
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

const idSchema = z.object({ orgId: z.string().min(1) });

const approveSchema = idSchema;
const rejectSchema = idSchema.extend({
  reason: z
    .string()
    .trim()
    .min(10, "Give the org a clear reason (10+ chars).")
    .max(500),
});
const requestChangesSchema = idSchema.extend({
  note: z
    .string()
    .trim()
    .min(10, "Tell the org what to change (10+ chars).")
    .max(500),
});

/**
 * Phase 9.10 approve  the richer version: stamps verifiedAt +
 * verifiedByUserId, clears stale rejection/admin-note, fires the
 * org.verified notification. The legacy `approveOrganisation` in
 * `lib/admin/verifications.ts` stays for backwards compat with the
 * old admin-tab UI but new code should call this.
 */
export async function approveOrg(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      verification: schema.organizations.verification,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, parsed.data.orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Organisation not found.");

  await db
    .update(schema.organizations)
    .set({
      verification: "verified",
      verifiedAt: new Date(),
      verifiedByUserId: session.id,
      rejectionReason: null,
      adminNote: null,
    })
    .where(eq(schema.organizations.id, row.id));

  await logAccess({
    kind: "org.review.approve",
    actor: session.id,
    subject: row.id,
    meta: { name: row.name, previousState: row.verification },
  });

  await notifyOrgMembers(row.id, {
    kind: "org.verified",
    title: "Your organisation is verified",
    body: `${row.name} is now a verified employer  candidate reveal, document downloads, and vacancy invites are unlocked for every member of your team. Your account reference is ${row.id}.`,
    link: "/employer",
    meta: { orgId: row.id, orgName: row.name },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/organisations");
  revalidatePath("/employer");
  revalidatePath("/employer/onboarding");
  revalidatePath("/employer/organisation");
  return ok();
}

export async function rejectOrg(
  input: z.infer<typeof rejectSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const db = getDb();

  const rows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      verification: schema.organizations.verification,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, parsed.data.orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Organisation not found.");

  await db
    .update(schema.organizations)
    .set({
      verification: "rejected",
      rejectionReason: parsed.data.reason,
      adminNote: null,
      verifiedAt: null,
      verifiedByUserId: null,
    })
    .where(eq(schema.organizations.id, row.id));

  await logAccess({
    kind: "org.review.reject",
    actor: session.id,
    subject: row.id,
    meta: {
      name: row.name,
      previousState: row.verification,
      reason: parsed.data.reason,
    },
  });

  await notifyOrgMembers(row.id, {
    kind: "org.rejected",
    title: "Your verification was not approved",
    body: `${row.name}  reason: ${parsed.data.reason}. Contact support if you'd like to discuss.`,
    link: "/employer/onboarding",
    meta: { orgId: row.id, orgName: row.name, reason: parsed.data.reason },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/organisations");
  revalidatePath("/employer/onboarding");
  return ok();
}

/**
 * Soft-reject. Flips back to `unverified` + stamps `adminNote`.
 * The Owner lands on the onboarding form with a yellow banner and
 * their previous text fields pre-filled. Per D5, the previously-
 * uploaded docs stay  the Owner replaces only what's flagged.
 */
export async function requestChangesOnOrg(
  input: z.infer<typeof requestChangesSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = requestChangesSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const db = getDb();

  const rows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      verification: schema.organizations.verification,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, parsed.data.orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Organisation not found.");

  await db
    .update(schema.organizations)
    .set({
      verification: "unverified",
      adminNote: parsed.data.note,
      rejectionReason: null,
    })
    .where(eq(schema.organizations.id, row.id));

  await logAccess({
    kind: "org.review.request-changes",
    actor: session.id,
    subject: row.id,
    meta: {
      name: row.name,
      previousState: row.verification,
      note: parsed.data.note,
    },
  });

  await notifyOrgMembers(row.id, {
    kind: "org.review.changes",
    title: "Our team asked you to revise your application",
    body: `${row.name}  admin note: ${parsed.data.note}. Open your application to revise + resubmit.`,
    link: "/employer/onboarding",
    meta: { orgId: row.id, orgName: row.name, note: parsed.data.note },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/organisations");
  revalidatePath("/employer/onboarding");
  return ok();
}

/**
 * Re-fires the Better Auth verification email for the Owner. No
 * state change. Useful when the Owner says they never got the
 * original email.
 */
export async function resendOrgVerificationEmail(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const owners = await db
    .select({
      userId: schema.organizationMembers.userId,
      email: schema.appUser.email,
      emailVerified: schema.appUser.emailVerified,
    })
    .from(schema.organizationMembers)
    .innerJoin(
      schema.appUser,
      eq(schema.appUser.id, schema.organizationMembers.userId),
    )
    .where(
      and(
        eq(schema.organizationMembers.organizationId, parsed.data.orgId),
        eq(schema.organizationMembers.role, "owner"),
      ),
    )
    .limit(1);
  const owner = owners[0];
  if (!owner) return fail("Org Owner not found.");
  if (owner.emailVerified) return fail("Owner's email is already verified.");

  try {
    await betterAuth.api.sendVerificationEmail({
      body: { email: owner.email, callbackURL: "/verify-email" },
    });
  } catch (e) {
    return fail(
      e instanceof Error ? e.message : "Resend failed. Try again.",
    );
  }

  await logAccess({
    kind: "org.verification.resend",
    actor: session.id,
    subject: parsed.data.orgId,
    meta: { ownerUserId: owner.userId },
  });

  return ok();
}

/**
 * Break-glass. Flips emailVerified=true for the Owner. Use when
 * Outlook Safe Links pre-consumed the verification token, or when
 * the Owner lost the email entirely. Does NOT sign the user in
 * an admin shouldn't silently land in someone else's session.
 *
 * Refuses if already verified (no-op makes the audit trail noisy).
 */
export async function markOrgEmailVerified(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const owners = await db
    .select({
      userId: schema.organizationMembers.userId,
      email: schema.appUser.email,
      emailVerified: schema.appUser.emailVerified,
    })
    .from(schema.organizationMembers)
    .innerJoin(
      schema.appUser,
      eq(schema.appUser.id, schema.organizationMembers.userId),
    )
    .where(
      and(
        eq(schema.organizationMembers.organizationId, parsed.data.orgId),
        eq(schema.organizationMembers.role, "owner"),
      ),
    )
    .limit(1);
  const owner = owners[0];
  if (!owner) return fail("Org Owner not found.");
  if (owner.emailVerified) return fail("Owner is already verified.");

  await db
    .update(schema.appUser)
    .set({ emailVerified: true })
    .where(eq(schema.appUser.id, owner.userId));

  await logAccess({
    kind: "verification.manual-grant",
    actor: session.id,
    subject: parsed.data.orgId,
    meta: { ownerUserId: owner.userId, ownerEmail: owner.email },
  });

  // In-app notification to the Owner so they know what happened.
  await createNotification({
    userId: owner.userId,
    kind: "org.documents.submitted", // re-use closest kind for in-app
    title: "Your email was verified by support",
    body: "An admin marked your email as verified on your behalf. Sign in and continue your onboarding.",
    link: "/employer/onboarding",
    meta: { orgId: parsed.data.orgId, manual: true },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/organisations");
  return ok();
}
