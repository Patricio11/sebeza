"use server";

/**
 * Phase 9.23  opt-in employment verification.
 *
 * Three public surfaces:
 *
 *   requestEmploymentVerification  seeker submits the contact + email
 *   withdrawEmploymentVerification seeker pulls before contact responds
 *   respondToVerification          public endpoint hit from the email
 *                                   link (no session required); records
 *                                   the contact's binary outcome,
 *                                   redacts the email, fires the
 *                                   seeker outcome notification
 *
 * Plus one read used by the dashboard editor:
 *
 *   getMyEmploymentVerification    the seeker's most recent active or
 *                                   recently-resolved record
 *
 * POPIA D0  the seeker explicitly consents to share a third party's
 * contact. The consent.grant audit row keys on contact_email_hash
 * (SHA-256) so the proof exists without storing the raw identifier
 * durably. The encrypted email column on the row is redacted
 * immediately on any state transition out of 'pending'.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";
import { encryptField } from "@/lib/crypto";
import { sendEmail } from "@/lib/email/send";
import { employmentVerificationEmail } from "@/lib/email/templates/employment-verification";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/** D3  fixed 14-day window. */
const VERIFICATION_WINDOW_DAYS = 14;
/** D6  badge lifetime. */
const VERIFICATION_BADGE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;
/** D8  per (profile, contact-hash) rate-limit window. */
const PER_CONTACT_RATE_LIMIT_MS = 365 * 24 * 60 * 60 * 1000;
const PER_CONTACT_RATE_LIMIT_COUNT = 2;

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function generateToken(): string {
  // 32 bytes  256 bits of entropy; URL-safe base64 strips padding.
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────

export interface MyVerificationRow {
  id: string;
  employerOrgId: string;
  employerName: string | null;
  contactName: string;
  state:
    | "pending"
    | "verified"
    | "declined"
    | "disputed"
    | "expired"
    | "superseded"
    | "withdrawn";
  requestedAt: string;
  respondedAt: string | null;
  expiresAt: string;
}

/**
 * Most recent verification for the signed-in seeker. The dashboard
 * uses it to decide whether to show the consent form or the in-flight
 * "Withdraw" panel. Returns NULL when the seeker has never requested.
 */
export async function getMyEmploymentVerification(): Promise<MyVerificationRow | null> {
  const session = await verifyRole("seeker");
  const db = getDb();
  const rows = await db
    .select({
      id: schema.employmentVerifications.id,
      employerOrgId: schema.employmentVerifications.employerOrgId,
      contactName: schema.employmentVerifications.contactName,
      state: schema.employmentVerifications.state,
      requestedAt: schema.employmentVerifications.requestedAt,
      respondedAt: schema.employmentVerifications.respondedAt,
      expiresAt: schema.employmentVerifications.expiresAt,
      employerName: schema.organizations.name,
    })
    .from(schema.employmentVerifications)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.employmentVerifications.profileId),
    )
    .leftJoin(
      schema.organizations,
      eq(
        schema.organizations.id,
        schema.employmentVerifications.employerOrgId,
      ),
    )
    .where(eq(schema.profiles.userId, session.id))
    .orderBy(desc(schema.employmentVerifications.requestedAt))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    employerOrgId: r.employerOrgId,
    employerName: r.employerName ?? null,
    contactName: r.contactName,
    state: r.state as MyVerificationRow["state"],
    requestedAt: r.requestedAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Request (seeker submits)
// ─────────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  /** Must match the seeker's current `profiles.current_employer_org_id`. */
  employerOrgId: z.string().min(1),
  contactName: z
    .string()
    .trim()
    .min(2, "Contact name must be at least 2 characters.")
    .max(120, "Contact name must be 120 characters or fewer."),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid work email for the contact.")
    .max(160),
  /** D0  the consent ticker on the form. Required true. */
  consentAccepted: z.literal(true, {
    errorMap: () => ({
      message:
        "You must tick the consent box to email the contact once on your behalf.",
    }),
  }),
});

export async function requestEmploymentVerification(
  input: z.infer<typeof requestSchema>,
): Promise<ActionResult<{ verificationId: string }>> {
  const session = await verifyRole("seeker");
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const v = parsed.data;
  const db = getDb();

  // Locate the seeker's profile + ensure status='employed' (D2) +
  // ensure the declared employer matches.
  const profileRows = await db
    .select({
      id: schema.profiles.id,
      status: schema.profiles.status,
      currentEmployerOrgId: schema.profiles.currentEmployerOrgId,
      displayName: schema.profiles.displayName,
    })
    .from(schema.profiles)
    .where(
      and(eq(schema.profiles.userId, session.id), isNull(schema.profiles.deletedAt)),
    )
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return fail("Profile not found.");
  if (profile.status !== "employed") {
    return fail(
      "Verification is only available when your status is Employed. Self-employed seekers can declare their employer without verification.",
    );
  }
  if (profile.currentEmployerOrgId !== v.employerOrgId) {
    return fail(
      "The employer on your profile no longer matches the one you're verifying  refresh the page and try again.",
    );
  }

  // Org must be picker-visible (sebenza_registered OR verified
  // seeker_named). Same posture as Phase 9.22's listEmployerOptions.
  const orgRows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      origin: schema.organizations.origin,
      verification: schema.organizations.verification,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, v.employerOrgId))
    .limit(1);
  const org = orgRows[0];
  if (!org) return fail("Employer not found.");
  if (
    !(org.origin === "sebenza_registered" || org.verification === "verified")
  ) {
    return fail(
      "Verification requires a verified employer. Your employer is still awaiting admin review.",
    );
  }

  const contactHash = hashEmail(v.contactEmail);

  // Rate-limit: at most one open verification at a time + at most 2
  // verifications per (profile, contact_email_hash) per 12 months.
  const existingOpen = await db
    .select({ id: schema.employmentVerifications.id })
    .from(schema.employmentVerifications)
    .where(
      and(
        eq(schema.employmentVerifications.profileId, profile.id),
        eq(schema.employmentVerifications.state, "pending"),
      ),
    )
    .limit(1);
  if (existingOpen[0]) {
    return fail(
      "You already have an in-flight verification request. Withdraw it before submitting a new one.",
    );
  }
  const since = new Date(Date.now() - PER_CONTACT_RATE_LIMIT_MS);
  const recentToContact = await db
    .select({ id: schema.employmentVerifications.id })
    .from(schema.employmentVerifications)
    .where(
      and(
        eq(schema.employmentVerifications.profileId, profile.id),
        eq(schema.employmentVerifications.contactEmailHash, contactHash),
        gte(schema.employmentVerifications.requestedAt, since),
      ),
    );
  if (recentToContact.length >= PER_CONTACT_RATE_LIMIT_COUNT) {
    return fail(
      "You've hit the per-contact rate limit (2 requests per 12 months). Try a different contact at the same employer.",
    );
  }

  const id = `evr_${randomUUID()}`;
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(
    now.valueOf() + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.insert(schema.employmentVerifications).values({
    id,
    profileId: profile.id,
    employerOrgId: v.employerOrgId,
    contactName: v.contactName,
    contactEmailEnc: encryptField(v.contactEmail),
    contactEmailHash: contactHash,
    state: "pending",
    requestedAt: now,
    expiresAt,
    verificationToken: token,
  });

  // consent.grant audit row keyed on the hash (D0 proof).
  await logAccess({
    kind: "consent.grant",
    actor: session.id,
    subject: id,
    meta: {
      purpose: "employment_verification",
      verificationId: id,
      employerOrgId: v.employerOrgId,
      contactEmailHash: contactHash,
    },
  });

  await logAccess({
    kind: "employment.verification.request",
    actor: session.id,
    subject: id,
    meta: {
      verificationId: id,
      employerOrgId: v.employerOrgId,
      contactEmailHash: contactHash,
    },
  });

  // Fire the one-shot email. Best-effort  if the send fails, the
  // verification still exists; the seeker can withdraw + retry.
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://sebenzasa.com";
    const email = employmentVerificationEmail({
      contactName: v.contactName,
      seekerName: profile.displayName,
      orgName: org.name,
      origin,
      token,
      expiresAt: expiresAt.toISOString(),
    });
    await sendEmail({
      to: v.contactEmail,
      subject: email.subject,
      html: email.html,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[employment-verification] email send failed:", e);
  }

  revalidatePath("/dashboard/profile");
  return ok({ verificationId: id });
}

// ─────────────────────────────────────────────────────────────────────
// Withdraw (seeker pulls before contact responds)
// ─────────────────────────────────────────────────────────────────────

const withdrawSchema = z.object({
  verificationId: z.string().min(1),
});

export async function withdrawEmploymentVerification(
  input: z.infer<typeof withdrawSchema>,
): Promise<ActionResult> {
  const session = await verifyRole("seeker");
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  // Verify ownership + that it's pending.
  const rows = await db
    .select({
      id: schema.employmentVerifications.id,
      profileUserId: schema.profiles.userId,
      state: schema.employmentVerifications.state,
    })
    .from(schema.employmentVerifications)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.employmentVerifications.profileId),
    )
    .where(eq(schema.employmentVerifications.id, parsed.data.verificationId))
    .limit(1);
  const r = rows[0];
  if (!r || r.profileUserId !== session.id) {
    return fail("Verification request not found.");
  }
  if (r.state !== "pending") {
    return fail(
      "This verification has already been resolved  there's nothing to withdraw.",
    );
  }

  await db
    .update(schema.employmentVerifications)
    .set({
      state: "withdrawn",
      respondedAt: new Date(),
      contactEmailEnc: null,
      verificationToken: null,
    })
    .where(eq(schema.employmentVerifications.id, r.id));

  await logAccess({
    kind: "employment.verification.withdrawn",
    actor: session.id,
    subject: r.id,
    meta: { verificationId: r.id },
  });

  revalidatePath("/dashboard/profile");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────
// Respond (public endpoint  contact clicks email link)
// ─────────────────────────────────────────────────────────────────────

const respondSchema = z.object({
  token: z.string().min(8).max(128),
  outcome: z.enum(["verified", "declined", "disputed"]),
});

export interface RespondResult {
  ok: true;
  /** Display state for the public landing page after the response. */
  outcome: "verified" | "declined" | "disputed" | "already_resolved" | "expired";
  /** Org name so the landing page can say "Thanks for confirming Acme Lodge." */
  orgName: string;
  contactName: string;
}

export async function respondToVerification(
  input: z.infer<typeof respondSchema>,
): Promise<RespondResult | { ok: false; message: string }> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  // Lookup by token. The unique index guarantees one row at most.
  const rows = await db
    .select({
      id: schema.employmentVerifications.id,
      profileId: schema.employmentVerifications.profileId,
      profileUserId: schema.profiles.userId,
      profileDisplayName: schema.profiles.displayName,
      contactName: schema.employmentVerifications.contactName,
      contactEmailHash: schema.employmentVerifications.contactEmailHash,
      state: schema.employmentVerifications.state,
      employerOrgId: schema.employmentVerifications.employerOrgId,
      employerName: schema.organizations.name,
      expiresAt: schema.employmentVerifications.expiresAt,
    })
    .from(schema.employmentVerifications)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.employmentVerifications.profileId),
    )
    .leftJoin(
      schema.organizations,
      eq(
        schema.organizations.id,
        schema.employmentVerifications.employerOrgId,
      ),
    )
    .where(eq(schema.employmentVerifications.verificationToken, parsed.data.token))
    .limit(1);
  const r = rows[0];
  if (!r) return fail("This verification link has expired or is invalid.");

  // Idempotency: a second click after a successful response renders
  // a friendly "already resolved" page  no double-write, no failure.
  if (r.state !== "pending") {
    if (r.state === "expired") {
      return {
        ok: true,
        outcome: "expired",
        orgName: r.employerName ?? "the employer",
        contactName: r.contactName,
      };
    }
    return {
      ok: true,
      outcome: "already_resolved",
      orgName: r.employerName ?? "the employer",
      contactName: r.contactName,
    };
  }

  // Window check: pending past expiry is still acceptable on the
  // public endpoint as long as the row hasn't been cron-flipped yet
  // (the cron may run after the window). But surface "expired" to
  // the contact + don't change anything if we're past the limit.
  if (r.expiresAt.valueOf() < Date.now()) {
    return {
      ok: true,
      outcome: "expired",
      orgName: r.employerName ?? "the employer",
      contactName: r.contactName,
    };
  }

  const newState =
    parsed.data.outcome === "verified"
      ? "verified"
      : parsed.data.outcome === "declined"
        ? "declined"
        : "disputed";

  // Flip state + redact email + clear token in one update.
  await db
    .update(schema.employmentVerifications)
    .set({
      state: newState,
      respondedAt: new Date(),
      contactEmailEnc: null,
      verificationToken: null,
    })
    .where(eq(schema.employmentVerifications.id, r.id));

  // Audit kind by outcome.
  await logAccess({
    kind:
      newState === "verified"
        ? "employment.verification.contact_verified"
        : newState === "declined"
          ? "employment.verification.contact_declined"
          : "employment.verification.contact_disputed",
    actor: "anonymous", // contact has no Sebenza account
    subject: r.id,
    meta: {
      verificationId: r.id,
      employerOrgId: r.employerOrgId,
      contactEmailHash: r.contactEmailHash,
    },
  });

  // Notify the seeker  binary outcome only (D9).
  try {
    const positive = newState === "verified";
    await createNotification({
      userId: r.profileUserId,
      kind: "employment.verification.outcome",
      title: positive
        ? "Your employment verification went through"
        : "Your employment verification didn't go through",
      body: positive
        ? `Your contact at ${r.employerName ?? "the employer"} confirmed you work there. Your public profile now shows the "Employer-verified" badge.`
        : `Your contact at ${r.employerName ?? "the employer"} wasn't able to confirm your employment. You can request another verification any time with a different contact at the same employer.`,
      link: "/dashboard/profile",
      meta: { verificationId: r.id, outcome: newState },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[employment-verification] notify failed:", e);
  }

  revalidatePath("/dashboard/profile");
  // Public profile would need invalidating per-handle  fall through
  // to the ISR revalidate window since the verification badge can
  // tolerate a short staleness.

  return {
    ok: true,
    outcome:
      newState === "verified"
        ? "verified"
        : newState === "declined"
          ? "declined"
          : "disputed",
    orgName: r.employerName ?? "the employer",
    contactName: r.contactName,
  };
}

// ─────────────────────────────────────────────────────────────────────
// D7  supersede on employer change
// ─────────────────────────────────────────────────────────────────────

/**
 * Phase 9.23 D7  called from Phase 9.22's updateCurrentEmployment
 * when the seeker changes `current_employer_org_id`. Flips any
 * `pending` or `verified` verification for the PRIOR employer to
 * `state='superseded'`, redacts the contact email, fires the seeker
 * outcome notification (informational  no action required).
 *
 * Caller passes the profile id so we don't re-load the session.
 */
export async function supersedeEmploymentVerifications(args: {
  profileId: string;
  priorEmployerOrgId: string;
}): Promise<void> {
  const db = getDb();
  const active = await db
    .select({
      id: schema.employmentVerifications.id,
      state: schema.employmentVerifications.state,
      employerName: schema.organizations.name,
      profileUserId: schema.profiles.userId,
    })
    .from(schema.employmentVerifications)
    .leftJoin(
      schema.organizations,
      eq(
        schema.organizations.id,
        schema.employmentVerifications.employerOrgId,
      ),
    )
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.employmentVerifications.profileId),
    )
    .where(
      and(
        eq(schema.employmentVerifications.profileId, args.profileId),
        eq(
          schema.employmentVerifications.employerOrgId,
          args.priorEmployerOrgId,
        ),
        sql`${schema.employmentVerifications.state} IN ('pending', 'verified')`,
      ),
    );
  for (const row of active) {
    await db
      .update(schema.employmentVerifications)
      .set({
        state: "superseded",
        respondedAt: new Date(),
        contactEmailEnc: null,
        verificationToken: null,
      })
      .where(eq(schema.employmentVerifications.id, row.id));
    await logAccess({
      kind: "employment.verification.superseded",
      actor: "system",
      subject: row.id,
      meta: {
        verificationId: row.id,
        priorEmployerOrgId: args.priorEmployerOrgId,
      },
    });
    if (row.state === "verified") {
      try {
        await createNotification({
          userId: row.profileUserId,
          kind: "employment.verification.outcome",
          title: "Your employer-verified badge has been cleared",
          body: `You changed your current employer  the verified badge at ${row.employerName ?? "your previous employer"} no longer applies. You can request a new verification at your new employer any time.`,
          link: "/dashboard/profile",
          meta: { verificationId: row.id, outcome: "superseded" },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[employment-verification] supersede notify failed:", e);
      }
    }
  }
}

