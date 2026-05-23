"use server";

/**
 * Phase 5  Employer reveal flows.
 *
 * Three locks gate every reveal (`docs/PHASE_5_PLAN.md` re-check #1):
 *   1. Employer's organisation is verified
 *   2. Seeker has granted the relevant consent
 *      - `contact_reveal` for the contact card
 *      - `document_sharing` for a qualification download
 *   3. Action audit-logs the event with `actor = userId`,
 *      `subject = profileId`, `meta = { orgId, ... }`
 *
 * Missing any of these → action returns `{ ok: false, message }` with a
 * clear reason. **No silent failures.**
 *
 * `revealContact` returns the contact card (currently just email + city;
 * phone is Phase 8 alongside SMS verification).
 *
 * `downloadQualification` mints a short-lived signed URL for the file in
 * Supabase Storage. The audit row captures the qualification id; meta
 * carries the title so it's grep-able in the admin ledger.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { verifyOrgVerified } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { signedDocumentUrl } from "@/lib/storage/signed";
import { createNotification } from "@/lib/notifications/server";

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
// revealContact  emits the email + city after consent check
// ─────────────────────────────────────────────────────────────────────────────

export interface ContactReveal {
  email: string;
  city: string;
  /** Catalog version of the consent the seeker actually granted. */
  consentVersion: string;
  /** ISO timestamp  for the audit-log surface on the reveal card. */
  revealedAt: string;
}

export async function revealContact(input: {
  handle: string;
}): Promise<ActionResult<{ contact: ContactReveal }>> {
  if (!input?.handle) return fail("Missing profile handle.");
  const session = await verifyOrgVerified();

  // Phase 9 review (2026-05-23)  rate limiting deliberately NOT
  // enforced anywhere by default. The infrastructure exists in
  // `lib/rate-limit/` ready to wire when abuse is observed; until
  // then the existing protections (verified-org gate + per-reveal
  // consent check + audit log + 30-day reveal-gate window) carry the
  // load. Re-enable by importing `enforce("reveal", …)` and gating
  // the action  but only after observing real abuse patterns to
  // size the budget. See docs/popia/DPIA.md R-series.

  const db = getDb();

  // Look up the target profile + owning user + active consent.
  const profileRows = await db
    .select({
      profileId: schema.profiles.id,
      userId: schema.profiles.userId,
      email: schema.appUser.email,
      city: schema.profiles.city,
    })
    .from(schema.profiles)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.profiles.userId))
    .where(eq(schema.profiles.handle, input.handle))
    .limit(1);

  const row = profileRows[0];
  if (!row) return fail("Profile not found.");

  // Consent check  must be explicitly granted (not 'none' or 'revoked').
  const consentRows = await db
    .select({
      state: schema.consents.state,
      version: schema.consents.version,
    })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, row.userId),
        eq(schema.consents.purpose, "contact_reveal"),
      ),
    )
    .limit(1);

  const consent = consentRows[0];
  if (!consent || consent.state !== "granted") {
    return fail(
      "This seeker hasn't granted contact-reveal consent. We can't surface their details.",
    );
  }

  const now = new Date();

  await logAccess({
    kind: "profile.contact.reveal",
    actor: session.id,
    subject: row.profileId,
    meta: {
      orgId: session.orgId,
      handle: input.handle,
      consentVersion: consent.version,
    },
  });

  const orgNameRow = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const orgName = orgNameRow[0]?.name ?? "An employer";

  await createNotification({
    userId: row.userId,
    kind: "contact.revealed",
    title: `${orgName} revealed your contact`,
    body: "Your email was shared under your active consent (POPIA-logged).",
    link: "/dashboard/activity",
    meta: {
      orgId: session.orgId,
      orgName,
      consentVersion: consent.version,
    },
  });

  revalidatePath(`/employer/dossier/${input.handle}`);

  return ok({
    contact: {
      email: row.email,
      city: row.city,
      consentVersion: consent.version,
      revealedAt: now.toISOString(),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// downloadQualification  mints a 60-second signed URL for the file
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadQualification(input: {
  qualificationId: string;
}): Promise<ActionResult<{ url: string }>> {
  if (!input?.qualificationId) return fail("Missing qualification id.");
  const session = await verifyOrgVerified();
  const db = getDb();

  // Join the qualification → its profile → owning user → document_sharing
  // consent, in one round-trip. Refuse if any link breaks.
  const rows = await db
    .select({
      qualificationId: schema.qualifications.id,
      title: schema.qualifications.title,
      docKey: schema.qualifications.documentStorageKey,
      profileId: schema.profiles.id,
      handle: schema.profiles.handle,
      userId: schema.profiles.userId,
    })
    .from(schema.qualifications)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.qualifications.profileId))
    .where(eq(schema.qualifications.id, input.qualificationId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Qualification not found.");
  if (!row.docKey) {
    return fail("No document on file for that qualification.");
  }

  const consentRows = await db
    .select({ state: schema.consents.state })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, row.userId),
        eq(schema.consents.purpose, "document_sharing"),
      ),
    )
    .limit(1);
  if (consentRows[0]?.state !== "granted") {
    return fail(
      "This seeker hasn't granted document-sharing consent. We can't release the file.",
    );
  }

  const url = await signedDocumentUrl(row.docKey);
  if (!url) return fail("Couldn't generate a download link. Try again.");

  await logAccess({
    kind: "profile.document.download",
    actor: session.id,
    subject: row.profileId,
    meta: {
      orgId: session.orgId,
      handle: row.handle,
      qualificationId: row.qualificationId,
      title: row.title,
    },
  });

  const orgNameRow = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const orgName = orgNameRow[0]?.name ?? "An employer";

  await createNotification({
    userId: row.userId,
    kind: "document.downloaded",
    title: `${orgName} downloaded one of your documents`,
    body: `${row.title}  every download is audit-logged on your activity timeline.`,
    link: "/dashboard/activity",
    meta: {
      orgId: session.orgId,
      orgName,
      qualificationId: row.qualificationId,
      title: row.title,
    },
  });

  return ok({ url });
}
