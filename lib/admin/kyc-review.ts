"use server";

/**
 * Phase 9.16  admin-mediated seeker ID review.
 *
 * Mirrors the org-vetting shape from Phase 9.10 (lib/admin/org-vetting.ts):
 *
 *   listKycSubmissions       admin queue payload (pending + recent
 *                              outcomes), with a signed download URL
 *                              for each document scoped to a short TTL.
 *   approveSeekerId          stamps appUser.kycVerifiedAt +
 *                              appUser.kycTransactionId =
 *                              `manual:<adminId>` + clears the rejection
 *                              reason. Fires `kyc.approved` notification.
 *   rejectSeekerId           writes profiles.id_document_rejection_reason
 *                              + fires `kyc.rejected` notification with
 *                              the admin's note. Does NOT clear the
 *                              storage key  the seeker re-uploads from
 *                              the KYC panel, which then clears the
 *                              rejection reason as part of upload.
 *   requestChangesOnSeekerId soft variant of reject: clears the
 *                              storage key entirely so the seeker has
 *                              to re-upload (and the admin queue stops
 *                              showing the bad doc). Notification
 *                              re-uses `kyc.rejected` with a different
 *                              body  the action distinguishes intent
 *                              in the audit log, not the catalog.
 *
 * Authorisation: every action goes through verifyAdmin(). Reads are
 * paginated client-side from a single batch (admin queue is small for
 * Phase 9 launch  Phase 11 adds proper pagination if needed).
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";
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

export interface KycReviewRow {
  profileId: string;
  userId: string;
  displayName: string;
  handle: string;
  idDocumentKind: "sa_id" | "passport";
  passportCountry: string | null;
  uploadedAt: string;
  rejectionReason: string | null;
  kycVerifiedAt: string | null;
  /** Short-lived signed URL for the document. Null when sign fails or
   *  the seeker has no document attached. */
  signedUrl: string | null;
}

/**
 * Returns the admin queue, partitioned by state. "Pending review" =
 * the seeker has uploaded a document and their account is not yet
 * KYC-verified. "Verified" + "Rejected" mirror the lifecycle states so
 * the admin can see recent outcomes (+ undo / re-approve if needed).
 */
export async function listKycSubmissions(): Promise<{
  pending: KycReviewRow[];
  rejected: KycReviewRow[];
  verified: KycReviewRow[];
}> {
  await verifyAdmin();
  const db = getDb();

  // Pull every profile that has either:
  //   - an uploaded document (pending or rejected), OR
  //   - a manual KYC stamp on appUser (verified by an admin)
  // Joining to appUser captures the kycVerifiedAt + kycTransactionId so
  // the queue can show "approved 3 days ago by Patricio".
  const rows = await db
    .select({
      profileId: schema.profiles.id,
      userId: schema.profiles.userId,
      displayName: schema.profiles.displayName,
      handle: schema.profiles.handle,
      idDocumentKind: schema.profiles.idDocumentKind,
      passportCountry: schema.profiles.passportCountry,
      storageKey: schema.profiles.idDocumentStorageKey,
      uploadedAt: schema.profiles.idDocumentUploadedAt,
      rejectionReason: schema.profiles.idDocumentRejectionReason,
      kycVerifiedAt: schema.appUser.kycVerifiedAt,
      kycTransactionId: schema.appUser.kycTransactionId,
      deletedAt: schema.profiles.deletedAt,
    })
    .from(schema.profiles)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.profiles.userId))
    .where(
      and(
        isNull(schema.profiles.deletedAt),
        // Surface anything with an uploaded doc OR an admin stamp.
        sql`(${schema.profiles.idDocumentStorageKey} IS NOT NULL OR ${schema.appUser.kycVerifiedAt} IS NOT NULL)`,
      ),
    )
    .orderBy(desc(schema.profiles.idDocumentUploadedAt))
    .limit(500);

  const pending: KycReviewRow[] = [];
  const rejected: KycReviewRow[] = [];
  const verified: KycReviewRow[] = [];

  for (const r of rows) {
    let signedUrl: string | null = null;
    if (r.storageKey) {
      try {
        signedUrl = await signedDocumentUrl(r.storageKey);
      } catch {
        signedUrl = null;
      }
    }
    const entry: KycReviewRow = {
      profileId: r.profileId,
      userId: r.userId,
      displayName: r.displayName,
      handle: r.handle,
      idDocumentKind: r.idDocumentKind as "sa_id" | "passport",
      passportCountry: r.passportCountry ?? null,
      uploadedAt: r.uploadedAt?.toISOString() ?? "",
      rejectionReason: r.rejectionReason ?? null,
      kycVerifiedAt: r.kycVerifiedAt?.toISOString() ?? null,
      signedUrl,
    };

    if (r.kycVerifiedAt) {
      verified.push(entry);
    } else if (r.rejectionReason) {
      rejected.push(entry);
    } else if (r.storageKey) {
      pending.push(entry);
    }
  }

  return { pending, rejected, verified };
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

const approveSchema = z.object({ profileId: z.string().min(1) });
const rejectSchema = z.object({
  profileId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "Tell the seeker what went wrong (10+ chars).")
    .max(500),
});
const requestChangesSchema = z.object({
  profileId: z.string().min(1),
  note: z
    .string()
    .trim()
    .min(10, "Tell the seeker what to re-upload (10+ chars).")
    .max(500),
});

/**
 * Approve the document  marks the seeker KYC-verified.
 *
 * Writes appUser.kycVerifiedAt + kycTransactionId so the existing
 * profile-level KYC badge (Phase 8) lights up; clears the rejection
 * reason on profiles so a re-approval after rejection sweeps the old
 * state.
 */
export async function approveSeekerId(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({
      profileId: schema.profiles.id,
      userId: schema.profiles.userId,
      displayName: schema.profiles.displayName,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, parsed.data.profileId))
    .limit(1);
  const profile = rows[0];
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.appUser)
    .set({
      kycVerifiedAt: new Date(),
      kycTransactionId: `manual:${session.id}`,
    })
    .where(eq(schema.appUser.id, profile.userId));

  await db
    .update(schema.profiles)
    .set({ idDocumentRejectionReason: null })
    .where(eq(schema.profiles.id, profile.profileId));

  await logAccess({
    kind: "kyc.review.approve",
    actor: session.id,
    subject: profile.profileId,
    meta: { userId: profile.userId },
  });

  await createNotification({
    userId: profile.userId,
    kind: "kyc.approved",
    title: "Your identity document was approved",
    body: "Thanks  an admin reviewed your ID and you're now KYC-verified on Sebenza.",
    link: "/dashboard/profile",
    meta: { profileId: profile.profileId },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/dashboard/profile");
  return ok();
}

/**
 * Reject the document  records the reason on the profile but keeps
 * the storage key so the admin can re-review without forcing the
 * seeker to re-upload first. The seeker's next upload clears the
 * rejection reason.
 */
export async function rejectSeekerId(
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
      profileId: schema.profiles.id,
      userId: schema.profiles.userId,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, parsed.data.profileId))
    .limit(1);
  const profile = rows[0];
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({ idDocumentRejectionReason: parsed.data.reason })
    .where(eq(schema.profiles.id, profile.profileId));

  // Make sure rejection never leaves a stale `verified` stamp behind.
  await db
    .update(schema.appUser)
    .set({ kycVerifiedAt: null, kycTransactionId: null })
    .where(eq(schema.appUser.id, profile.userId));

  await logAccess({
    kind: "kyc.review.reject",
    actor: session.id,
    subject: profile.profileId,
    meta: {
      userId: profile.userId,
      reason: parsed.data.reason,
      mode: "reject",
    },
  });

  await createNotification({
    userId: profile.userId,
    kind: "kyc.rejected",
    title: "Your identity document was rejected",
    body: `An admin reviewed your ID and asked for changes. Reason: ${parsed.data.reason}. Open your profile to re-upload.`,
    link: "/dashboard/profile",
    meta: { profileId: profile.profileId, reason: parsed.data.reason },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/dashboard/profile");
  return ok();
}

/**
 * Request changes  softer than a full reject. Clears the storage key
 * (so the admin queue doesn't keep showing the rejected doc) and
 * records the note on `id_document_rejection_reason`. The seeker has
 * to re-upload from the KYC panel  the next upload clears both fields.
 */
export async function requestChangesOnSeekerId(
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
      profileId: schema.profiles.id,
      userId: schema.profiles.userId,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, parsed.data.profileId))
    .limit(1);
  const profile = rows[0];
  if (!profile) return fail("Profile not found.");

  await db
    .update(schema.profiles)
    .set({
      idDocumentStorageKey: null,
      idDocumentUploadedAt: null,
      idDocumentRejectionReason: parsed.data.note,
    })
    .where(eq(schema.profiles.id, profile.profileId));

  await db
    .update(schema.appUser)
    .set({ kycVerifiedAt: null, kycTransactionId: null })
    .where(eq(schema.appUser.id, profile.userId));

  await logAccess({
    kind: "kyc.review.reject",
    actor: session.id,
    subject: profile.profileId,
    meta: {
      userId: profile.userId,
      reason: parsed.data.note,
      mode: "request-changes",
    },
  });

  await createNotification({
    userId: profile.userId,
    kind: "kyc.rejected",
    title: "Please re-upload your identity document",
    body: `Our team asked you to re-upload your ID. Note: ${parsed.data.note}. Open your profile to attach a new copy.`,
    link: "/dashboard/profile",
    meta: {
      profileId: profile.profileId,
      note: parsed.data.note,
      mode: "request-changes",
    },
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/dashboard/profile");
  return ok();
}
