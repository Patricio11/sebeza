"use server";

/**
 * Phase 9.10  Employer KYC / org vetting Server Actions.
 *
 * Two write actions (Owner-only):
 *   - uploadOrgDocumentFile(formData)  per-kind upload; replaces
 *     the previous file of that kind for non-`other` kinds; `other`
 *     is append-only (cap at 3 to stop infinite spam).
 *   - submitOrgOnboarding(input)       validates required docs +
 *     text fields all present, flips verification 'unverified'
 *     'pending', clears adminNote, fires admin queue + Owner
 *     confirmation notifications, audits as `org.submit`.
 *
 * Reads:
 *   - getMyOrgVettingState()  returns the org row + existing docs +
 *     the seeker-Owner's emailVerified flag (for the email-pending
 *     branch of the onboarding page). Permissive: any employer can
 *     read their own org's state.
 *
 * Privacy invariant: every read + write scopes by the caller's
 * organisation (resolved via `verifyEmployer()`  no hard
 * verification gate here, because the whole point of these surfaces
 * is for *unverified* orgs to act on their own state). The Owner
 * check is enforced at the action boundary  Recruiter / Viewer
 * members of an org cannot submit or change the verification state.
 *
 * Storage: documents land at `{ownerUserId}/org-documents/{docId}.{ext}`
 * via the existing `uploadOrgDocument()` helper (service-role,
 * server-side, magic-byte-sniffed). The Owner's userId is the folder
 * key so a `gov` audit query can scope by org owner without joining
 * to a separate uploads table.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { verifyEmployer } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { uploadOrgDocument, deleteStorageObject } from "@/lib/storage/upload";
import { StorageError } from "@/lib/storage/supabase";
import { createNotification, notifyAllAdmins } from "@/lib/notifications/server";
import { getMyOrgRole } from "./vacancies";
import { canEditVacancies } from "./vacancies-types";

// Types + label catalogue live in a plain sibling so client islands
// (OrgOnboardingForm, OrgReviewModal) can import them without
// dragging a "use server" boundary. Server Actions below use them
// via type-only imports.
import {
  ORG_DOCUMENT_LABEL,
  REQUIRED_DOC_KINDS,
  type OrgDocumentKind,
  type OrgVettingState,
} from "./vetting-types";

type ActionResult<T extends object = object> =
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

/**
 * Load the signed-in employer's org vetting state. Returns `null`
 * when the caller isn't part of any org (shouldn't happen for
 * `role='employer'` users post-signup, but the guard is here).
 *
 * Permissive  this is the surface unverified orgs need to read.
 */
export async function getMyOrgVettingState(): Promise<OrgVettingState | null> {
  const session = await verifyEmployer();
  if (!session.orgId) return null;
  const db = getDb();

  // Org row + Owner's emailVerified flag in one round trip.
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
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const org = orgRows[0];
  if (!org) return null;

  const userRows = await db
    .select({ emailVerified: schema.appUser.emailVerified })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, session.id))
    .limit(1);
  const emailVerified = userRows[0]?.emailVerified ?? false;

  const role = await getMyOrgRole();
  const isOwner = role === "owner";

  const docs = await db
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
    .where(eq(schema.organizationDocuments.organizationId, session.orgId));

  return {
    orgId: org.id,
    orgName: org.name,
    registrationNumber: org.registrationNumber,
    industry: org.industry,
    country: org.country,
    city: org.city,
    companyAddress: org.companyAddress,
    vatNumber: org.vatNumber,
    verification: org.verification as OrgVettingState["verification"],
    rejectionReason: org.rejectionReason,
    adminNote: org.adminNote,
    emailVerified,
    isOwner,
    documents: docs.map((d) => ({
      id: d.id,
      kind: d.kind as OrgDocumentKind,
      originalName: d.originalName,
      storageKey: d.storageKey,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: toIso(d.uploadedAt),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

const ORG_DOCUMENT_KINDS: OrgDocumentKind[] = [
  "company_reg_cert",
  "tax_clearance",
  "proof_of_address",
  "bank_confirmation",
  "other",
];

const OTHER_DOC_CAP = 3;

/**
 * Upload one KYC document. Replaces the previous file of the same
 * `kind` for non-`other` kinds (the unique partial index in
 * migration 0019 enforces "one row per (org, required-kind)"); for
 * `other`, appends a new row up to OTHER_DOC_CAP.
 *
 * Called from the onboarding form per-file as the user picks them
 * (no progress polling needed  one upload = one request).
 *
 * Owner-only. Returns the inserted row id so the form can show a
 * "delete" affordance per uploaded file.
 */
export async function uploadOrgDocumentFile(
  formData: FormData,
): Promise<ActionResult<{ documentId: string; storageKey: string }>> {
  const guard = await requireOwner();
  if (!guard.ok) return guard;

  const kindRaw = String(formData.get("kind") ?? "");
  const file = formData.get("file");
  if (!ORG_DOCUMENT_KINDS.includes(kindRaw as OrgDocumentKind)) {
    return fail("Unknown document kind.");
  }
  if (!(file instanceof File)) return fail("Missing file.");
  const kind = kindRaw as OrgDocumentKind;

  // Refuse uploads when the org has already submitted (`pending`)
  // or has been approved/rejected  the workflow is editable only
  // in `unverified` (which is the resubmit state after admin
  // request-changes too).
  if (guard.verification !== "unverified") {
    return fail(
      "Your application is no longer in the draft state. Contact support if you need to update documents.",
    );
  }

  const db = getDb();

  // Capacity check for `other`  prevent unbounded growth.
  if (kind === "other") {
    const existing = await db
      .select({ id: schema.organizationDocuments.id })
      .from(schema.organizationDocuments)
      .where(
        and(
          eq(schema.organizationDocuments.organizationId, guard.orgId),
          eq(schema.organizationDocuments.kind, "other"),
        ),
      );
    if (existing.length >= OTHER_DOC_CAP) {
      return fail(
        `You can upload at most ${OTHER_DOC_CAP} optional supporting documents.`,
      );
    }
  }

  const documentId = `orgdoc_${randomUUID()}`;

  let uploaded: { key: string; mime: string };
  try {
    uploaded = await uploadOrgDocument({
      userId: guard.userId,
      id: documentId,
      file,
    });
  } catch (e) {
    if (e instanceof StorageError) return fail(e.message);
    return fail(
      e instanceof Error ? e.message : "Upload failed. Try again.",
    );
  }

  // For non-`other` kinds: delete any existing row + its storage
  // object first (the unique partial index would refuse the insert
  // otherwise; cleanup avoids orphans).
  if (kind !== "other") {
    const previous = await db
      .select({
        id: schema.organizationDocuments.id,
        storageKey: schema.organizationDocuments.storageKey,
      })
      .from(schema.organizationDocuments)
      .where(
        and(
          eq(schema.organizationDocuments.organizationId, guard.orgId),
          eq(schema.organizationDocuments.kind, kind),
        ),
      )
      .limit(1);
    if (previous[0]) {
      await db
        .delete(schema.organizationDocuments)
        .where(eq(schema.organizationDocuments.id, previous[0].id));
      try {
        await deleteStorageObject(previous[0].storageKey);
      } catch {
        // Best-effort cleanup; not fatal.
      }
    }
  }

  await db.insert(schema.organizationDocuments).values({
    id: documentId,
    organizationId: guard.orgId,
    kind,
    originalName: file.name,
    storageKey: uploaded.key,
    mimeType: uploaded.mime,
    sizeBytes: file.size,
    uploadedByUserId: guard.userId,
  });

  await logAccess({
    kind: "org.documents.upload",
    actor: guard.userId,
    subject: guard.orgId,
    meta: {
      documentId,
      docKind: kind,
      originalName: file.name,
      sizeBytes: file.size,
    },
  });

  revalidatePath("/employer/onboarding");
  return ok({ documentId, storageKey: uploaded.key });
}

/**
 * Delete a single uploaded document. Owner-only; only while the org
 * is in `unverified` state. Removes the storage object on success
 * (best-effort).
 */
export async function deleteOrgDocument(
  documentId: string,
): Promise<ActionResult> {
  const guard = await requireOwner();
  if (!guard.ok) return guard;
  if (guard.verification !== "unverified") {
    return fail(
      "Documents can only be removed while your application is in draft state.",
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.organizationDocuments.id,
      storageKey: schema.organizationDocuments.storageKey,
      kind: schema.organizationDocuments.kind,
    })
    .from(schema.organizationDocuments)
    .where(
      and(
        eq(schema.organizationDocuments.id, documentId),
        eq(schema.organizationDocuments.organizationId, guard.orgId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Document not found.");

  await db
    .delete(schema.organizationDocuments)
    .where(eq(schema.organizationDocuments.id, documentId));

  try {
    await deleteStorageObject(row.storageKey);
  } catch {
    // Best-effort.
  }

  revalidatePath("/employer/onboarding");
  return ok();
}

const submitSchema = z.object({
  companyAddress: z.string().trim().min(10).max(500),
  vatNumber: z.string().trim().max(20).nullable().optional(),
  city: z.string().trim().min(2).max(80).nullable().optional(),
});

/**
 * Finalise the onboarding application. Validates required text +
 * doc slots, flips verification 'unverified'  'pending', clears
 * the admin note (resubmit case), fires the admin-queue
 * notification + the Owner confirmation, audits as `org.submit`.
 */
export async function submitOrgOnboarding(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult> {
  const guard = await requireOwner();
  if (!guard.ok) return guard;

  if (guard.verification === "verified") {
    return fail("Your organisation is already verified.");
  }
  if (guard.verification === "pending") {
    return fail("Your application is already under review.");
  }

  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    );
  }
  const v = parsed.data;

  const db = getDb();

  // Required-doc check: one row per required kind must exist.
  const docs = await db
    .select({ kind: schema.organizationDocuments.kind })
    .from(schema.organizationDocuments)
    .where(eq(schema.organizationDocuments.organizationId, guard.orgId));
  const haveKinds = new Set(docs.map((d) => d.kind as OrgDocumentKind));
  const missing = REQUIRED_DOC_KINDS.filter((k) => !haveKinds.has(k));
  if (missing.length > 0) {
    return fail(
      `Still missing: ${missing.map((k) => ORG_DOCUMENT_LABEL[k]).join(", ")}.`,
    );
  }

  await db
    .update(schema.organizations)
    .set({
      verification: "pending",
      companyAddress: v.companyAddress,
      vatNumber: v.vatNumber?.trim() || null,
      city: v.city?.trim() || null,
      adminNote: null, // clear request-changes note on resubmit
      rejectionReason: null, // clear stale rejection if any
    })
    .where(eq(schema.organizations.id, guard.orgId));

  await logAccess({
    kind: "org.submit",
    actor: guard.userId,
    subject: guard.orgId,
    meta: {
      documentCount: docs.length,
      requiredDocsPresent: true,
    },
  });

  // Notify admins (in-app + email if configured); confirmation to Owner.
  await notifyAllAdmins({
    kind: "verification.queued",
    title: `${guard.orgName} submitted KYC for review`,
    body: "Open the admin organisations queue to review the submission.",
    link: "/admin/organisations",
    meta: { orgId: guard.orgId },
  });
  await createNotification({
    userId: guard.userId,
    kind: "org.documents.submitted",
    title: "We received your verification application",
    body: "Our team typically reviews within one business day. You'll get an email when there's a decision.",
    link: "/employer/onboarding",
    meta: { orgId: guard.orgId },
  });

  revalidatePath("/employer/onboarding");
  revalidatePath("/employer");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface OwnerGuard {
  ok: true;
  userId: string;
  orgId: string;
  orgName: string;
  verification: OrgVettingState["verification"];
}

async function requireOwner(): Promise<
  OwnerGuard | { ok: false; message: string }
> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation context.");
  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    return fail(
      "Only the organisation Owner can change the verification state. Ask your Owner to sign in.",
    );
  }
  // canEditVacancies = owner|recruiter; for vetting we require Owner only.
  if (role !== "owner") {
    return fail(
      "Only the organisation Owner can submit or edit the verification documents.",
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      verification: schema.organizations.verification,
      name: schema.organizations.name,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Organisation not found.");
  return {
    ok: true,
    userId: session.id,
    orgId: session.orgId,
    orgName: row.name,
    verification: row.verification as OrgVettingState["verification"],
  };
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
