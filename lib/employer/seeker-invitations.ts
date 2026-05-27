"use server";

/**
 * Phase 9.17  employer-initiated seeker invitations.
 *
 * Five public Server Actions cover the lifecycle:
 *
 *   inviteSeeker                 verified-org employer creates an invite
 *   withdrawSeekerInvitation     employer cancels a pending invite
 *   resendSeekerInvitation       employer re-fires the email (with the
 *                                 same rate-limit check as a fresh send)
 *   declineSeekerInvitation      recipient declines via the email link
 *                                 (no auth  the token is the proof)
 *   reportSeekerInvitation       recipient reports an abusive invite
 *                                 (no auth, no row mutation  flags an
 *                                 admin notification)
 *
 * Plus one read:
 *
 *   listOrgInvitations()         the employer dashboard's three-section
 *                                 pending / joined / declined view
 *
 * The accept path (`acceptSeekerInvitation`) lives in `lib/auth/actions.ts`
 * because it wraps `signUpSeeker` + flips the invite row in one
 * transaction. Keeping all sign-up paths in one module makes the
 * Better Auth + consent-rows insert sequence easier to reason about.
 *
 * Lookups + uniqueness use `lower(email)` so case variations of the
 * same address ("ME@example.com" vs "me@example.com") don't bypass the
 * cooldown or dedupe.
 *
 * Every action audits + every block is server-side enforced. Every
 * pre-DB validation is mirrored at the zod layer + re-checked against
 * the row state inside the transaction  the verify-twice posture
 * matches Phase 9.16 + 9.10.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyOrgVerified } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { notifyAllAdmins } from "@/lib/notifications/server";
import { sendEmail } from "@/lib/email/send";
import { seekerInviteEmail } from "@/lib/email/templates/seeker-invite";
import { signInviteToken, verifyInviteToken } from "@/lib/auth/invite-tokens";

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
// Knobs (D7  rate limit + cooldown + platform cap)
// ─────────────────────────────────────────────────────────────────────────────

const INVITE_TTL_DAYS = 14;
const PER_ORG_DAILY_CAP = 50;
const PER_EMAIL_DECLINE_COOLDOWN_DAYS = 90;
const PLATFORM_DAILY_CAP = 500;
/** Per-day window  resets at UTC midnight. Simpler than rolling
 *  windows + good enough for an anti-abuse cap. */
function startOfTodayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function originFromEnv(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

// ─────────────────────────────────────────────────────────────────────────────
// inviteSeeker  the main entry point
// ─────────────────────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(120).optional(),
  profession: z.string().trim().min(1).max(80).optional(),
  personalNote: z.string().trim().max(200).optional(),
});

export async function inviteSeeker(
  input: z.infer<typeof inviteSchema>,
): Promise<ActionResult<{ inviteId: string }>> {
  const session = await verifyOrgVerified();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const v = parsed.data;
  const emailLower = v.email.toLowerCase();
  const db = getDb();

  // ── Rate limit (D7.1) ─────────────────────────────────────────────
  // Counts EVERY attempt today  successful + dedupe + cooldown +
  // validation errors that reached this point. That's the structural
  // defence behind D4's transparent dedupe.
  const todayStart = startOfTodayUTC();
  const orgTodayRows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.seekerInvitations)
    .where(
      and(
        eq(schema.seekerInvitations.organizationId, session.orgId),
        sql`${schema.seekerInvitations.createdAt} >= ${todayStart}`,
      ),
    );
  if ((orgTodayRows[0]?.n ?? 0) >= PER_ORG_DAILY_CAP) {
    await logAccess({
      kind: "org.seeker_invite.send",
      actor: session.id,
      meta: { email: emailLower, blockedBy: "org_daily_cap" },
    });
    return fail(
      `You've reached today's invitation cap (${PER_ORG_DAILY_CAP}). Try again tomorrow.`,
    );
  }

  // ── Platform cap (D7.3) ───────────────────────────────────────────
  const platformTodayRows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.seekerInvitations)
    .where(sql`${schema.seekerInvitations.createdAt} >= ${todayStart}`);
  if ((platformTodayRows[0]?.n ?? 0) >= PLATFORM_DAILY_CAP) {
    await logAccess({
      kind: "org.seeker_invite.send",
      actor: session.id,
      meta: { email: emailLower, blockedBy: "platform_daily_cap" },
    });
    return fail("Sebenza is at capacity for invitations today. Please try again tomorrow.");
  }

  // ── D4  transparent dedupe when email already has an account ─────
  const existingUser = await db
    .select({ id: schema.appUser.id })
    .from(schema.appUser)
    .where(sql`lower(${schema.appUser.email}) = ${emailLower}`)
    .limit(1);
  if (existingUser.length > 0) {
    await logAccess({
      kind: "org.seeker_invite.send",
      actor: session.id,
      meta: { email: emailLower, dedupe: "existing_user" },
    });
    return fail(
      "This email already has a Sebenza account. Search for them by name on Talent search to invite them to a vacancy.",
    );
  }

  // ── D7.2  per-email decline cooldown ─────────────────────────────
  const cooldownCutoff = new Date(
    Date.now() - PER_EMAIL_DECLINE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
  const recentDecline = await db
    .select({ id: schema.seekerInvitations.id })
    .from(schema.seekerInvitations)
    .where(
      and(
        eq(schema.seekerInvitations.organizationId, session.orgId),
        sql`lower(${schema.seekerInvitations.email}) = ${emailLower}`,
        eq(schema.seekerInvitations.state, "declined"),
        sql`${schema.seekerInvitations.respondedAt} >= ${cooldownCutoff}`,
      ),
    )
    .limit(1);
  if (recentDecline.length > 0) {
    await logAccess({
      kind: "org.seeker_invite.send",
      actor: session.id,
      meta: { email: emailLower, blockedBy: "decline_cooldown" },
    });
    return fail(
      "This email declined a recent invitation from your organisation. POPIA §11 means we honour that for 90 days from the decline.",
    );
  }

  // ── De-dupe an already-pending invite from THIS org ──────────────
  // (We don't enforce a unique constraint on (org_id, lower(email))
  //  because the same address can legitimately have a declined +
  //  withdrawn + pending row over time. But re-pending while one is
  //  already open is just noise; collapse to the existing row.)
  const openInvite = await db
    .select({ id: schema.seekerInvitations.id })
    .from(schema.seekerInvitations)
    .where(
      and(
        eq(schema.seekerInvitations.organizationId, session.orgId),
        sql`lower(${schema.seekerInvitations.email}) = ${emailLower}`,
        eq(schema.seekerInvitations.state, "pending"),
      ),
    )
    .limit(1);
  if (openInvite[0]) {
    return fail(
      "You already have a pending invitation to this email. Resend or withdraw it from the Invites tab.",
    );
  }

  // ── Create the row + send the email ──────────────────────────────
  const inviteId = `inv_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.seekerInvitations).values({
    id: inviteId,
    organizationId: session.orgId,
    invitedByUserId: session.id,
    email: v.email,
    name: v.name ?? null,
    profession: v.profession ?? null,
    personalNote: v.personalNote ?? null,
    expiresAt,
  });

  const token = signInviteToken(inviteId, expiresAt);
  const { subject, html } = seekerInviteEmail({
    recipientName: v.name ?? null,
    orgName: session.orgName,
    personalNote: v.personalNote ?? null,
    profession: v.profession ?? null,
    origin: originFromEnv(),
    token,
  });

  try {
    await sendEmail({ to: v.email, subject, html });
  } catch (e) {
    // The row is already in the DB; surface the email failure but
    // don't roll back  the employer can use the Resend action from
    // the dashboard to retry the email channel.
    console.error("[seeker-invite] sendEmail failed:", e);
    await logAccess({
      kind: "org.seeker_invite.send",
      actor: session.id,
      subject: inviteId,
      meta: { email: emailLower, emailError: "send_failed" },
    });
    return fail("Invitation was created, but the email failed to send. Use Resend from the Invites tab.");
  }

  await logAccess({
    kind: "org.seeker_invite.send",
    actor: session.id,
    subject: inviteId,
    meta: {
      email: emailLower,
      name: v.name ?? null,
      profession: v.profession ?? null,
      note: v.personalNote ?? null, // POPIA: PII territory
    },
  });

  revalidatePath("/employer/invites");
  return ok({ inviteId });
}

// ─────────────────────────────────────────────────────────────────────────────
// withdrawSeekerInvitation
// ─────────────────────────────────────────────────────────────────────────────

const withdrawSchema = z.object({ inviteId: z.string().min(1) });

export async function withdrawSeekerInvitation(
  input: z.infer<typeof withdrawSchema>,
): Promise<ActionResult> {
  const session = await verifyOrgVerified();
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.seekerInvitations.id,
      orgId: schema.seekerInvitations.organizationId,
      state: schema.seekerInvitations.state,
      email: schema.seekerInvitations.email,
    })
    .from(schema.seekerInvitations)
    .where(eq(schema.seekerInvitations.id, parsed.data.inviteId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Invitation not found.");
  if (row.orgId !== session.orgId) return fail("Invitation not found.");
  if (row.state !== "pending") {
    return fail(`Only pending invitations can be withdrawn (state: ${row.state}).`);
  }

  await db
    .update(schema.seekerInvitations)
    .set({ state: "withdrawn", respondedAt: new Date() })
    .where(eq(schema.seekerInvitations.id, row.id));

  await logAccess({
    kind: "org.seeker_invite.withdraw",
    actor: session.id,
    subject: row.id,
    meta: { email: row.email.toLowerCase() },
  });

  revalidatePath("/employer/invites");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// resendSeekerInvitation
// ─────────────────────────────────────────────────────────────────────────────

const resendSchema = z.object({ inviteId: z.string().min(1) });

export async function resendSeekerInvitation(
  input: z.infer<typeof resendSchema>,
): Promise<ActionResult> {
  const session = await verifyOrgVerified();
  const parsed = resendSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select({
      id: schema.seekerInvitations.id,
      orgId: schema.seekerInvitations.organizationId,
      state: schema.seekerInvitations.state,
      email: schema.seekerInvitations.email,
      name: schema.seekerInvitations.name,
      profession: schema.seekerInvitations.profession,
      personalNote: schema.seekerInvitations.personalNote,
      expiresAt: schema.seekerInvitations.expiresAt,
    })
    .from(schema.seekerInvitations)
    .where(eq(schema.seekerInvitations.id, parsed.data.inviteId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Invitation not found.");
  if (row.orgId !== session.orgId) return fail("Invitation not found.");
  if (row.state !== "pending") {
    return fail(`Only pending invitations can be resent (state: ${row.state}).`);
  }

  // Resends still count against today's cap  same rate-limit posture.
  const todayStart = startOfTodayUTC();
  const orgTodayRows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.seekerInvitations)
    .where(
      and(
        eq(schema.seekerInvitations.organizationId, session.orgId),
        sql`${schema.seekerInvitations.createdAt} >= ${todayStart}`,
      ),
    );
  if ((orgTodayRows[0]?.n ?? 0) >= PER_ORG_DAILY_CAP) {
    await logAccess({
      kind: "org.seeker_invite.send",
      actor: session.id,
      subject: row.id,
      meta: { email: row.email.toLowerCase(), blockedBy: "org_daily_cap", resend: true },
    });
    return fail(
      `You've reached today's invitation cap (${PER_ORG_DAILY_CAP}). Try again tomorrow.`,
    );
  }

  const token = signInviteToken(row.id, row.expiresAt);
  const { subject, html } = seekerInviteEmail({
    recipientName: row.name,
    orgName: session.orgName,
    personalNote: row.personalNote,
    profession: row.profession,
    origin: originFromEnv(),
    token,
  });

  try {
    await sendEmail({ to: row.email, subject, html });
  } catch (e) {
    console.error("[seeker-invite] resend failed:", e);
    return fail("Resend failed. Please try again later.");
  }

  await logAccess({
    kind: "org.seeker_invite.send",
    actor: session.id,
    subject: row.id,
    meta: { email: row.email.toLowerCase(), resend: true },
  });

  revalidatePath("/employer/invites");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// declineSeekerInvitation  no auth, the token IS the proof
// ─────────────────────────────────────────────────────────────────────────────

const declineSchema = z.object({
  token: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

export async function declineSeekerInvitation(
  input: z.infer<typeof declineSchema>,
): Promise<ActionResult> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const v = parsed.data;

  const tokenCheck = verifyInviteToken(v.token);
  if (!tokenCheck.ok) {
    return fail(
      tokenCheck.reason === "expired"
        ? "This invitation link has expired."
        : "This invitation link is invalid.",
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.seekerInvitations.id,
      state: schema.seekerInvitations.state,
      email: schema.seekerInvitations.email,
      orgId: schema.seekerInvitations.organizationId,
    })
    .from(schema.seekerInvitations)
    .where(eq(schema.seekerInvitations.id, tokenCheck.inviteId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("This invitation no longer exists.");
  if (row.state !== "pending") {
    return fail(`This invitation has already been ${row.state}.`);
  }

  await db
    .update(schema.seekerInvitations)
    .set({
      state: "declined",
      declineReason: v.reason ?? null,
      respondedAt: new Date(),
    })
    .where(eq(schema.seekerInvitations.id, row.id));

  await logAccess({
    kind: "org.seeker_invite.decline",
    actor: "anonymous",
    subject: row.id,
    meta: {
      email: row.email.toLowerCase(),
      orgId: row.orgId,
      reason: v.reason ?? null,
    },
  });

  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// reportSeekerInvitation  no auth, no row mutation  flags admins
// ─────────────────────────────────────────────────────────────────────────────

const reportSchema = z.object({
  token: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export async function reportSeekerInvitation(
  input: z.infer<typeof reportSchema>,
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const v = parsed.data;

  const tokenCheck = verifyInviteToken(v.token);
  if (!tokenCheck.ok) {
    return fail("This invitation link is invalid.");
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.seekerInvitations.id,
      email: schema.seekerInvitations.email,
      orgId: schema.seekerInvitations.organizationId,
      orgName: schema.organizations.name,
    })
    .from(schema.seekerInvitations)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.seekerInvitations.organizationId),
    )
    .where(eq(schema.seekerInvitations.id, tokenCheck.inviteId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("This invitation no longer exists.");

  await logAccess({
    kind: "org.seeker_invite.reported",
    actor: "anonymous",
    subject: row.id,
    meta: {
      email: row.email.toLowerCase(),
      orgId: row.orgId,
      reason: v.reason ?? null,
    },
  });

  await notifyAllAdmins({
    kind: "org.seeker_invite.reported",
    title: `Invitation reported by recipient`,
    body: `${row.orgName} invited ${row.email}; recipient reported the invite${v.reason ? `: "${v.reason}"` : "."} Review on /admin/verifications.`,
    link: "/admin/verifications",
    meta: { inviteId: row.id, orgId: row.orgId, reason: v.reason ?? null },
  });

  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Read: listOrgInvitations
// ─────────────────────────────────────────────────────────────────────────────

export interface InviteListRow {
  id: string;
  email: string;
  name: string | null;
  profession: string | null;
  state: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  declineReason: string | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  /** Public handle when accepted, null otherwise. The inviter can
   *  click through to the public profile  same redaction every other
   *  verified employer sees. */
  acceptedHandle: string | null;
  /** Display name on the accepted profile (already redacted via
   *  redactSurname() at sign-up). Null when not yet accepted. */
  acceptedDisplayName: string | null;
}

/**
 * Returns three buckets for the /employer/invites dashboard:
 *
 *   pending     active, not yet responded
 *   joined      seeker completed sign-up via this invite
 *   declined    seeker declined  includes the 90-day cooldown
 *                window so the row stays visible as honest history
 *
 * `withdrawn` + `expired` rows are intentionally hidden  they're
 * dead history that adds clutter. The data is still queryable via
 * the audit log if an admin needs to review.
 */
export async function listOrgInvitations(): Promise<{
  pending: InviteListRow[];
  joined: InviteListRow[];
  declined: InviteListRow[];
}> {
  const session = await verifyOrgVerified();
  const db = getDb();

  const rows = await db
    .select({
      id: schema.seekerInvitations.id,
      email: schema.seekerInvitations.email,
      name: schema.seekerInvitations.name,
      profession: schema.seekerInvitations.profession,
      state: schema.seekerInvitations.state,
      declineReason: schema.seekerInvitations.declineReason,
      createdAt: schema.seekerInvitations.createdAt,
      expiresAt: schema.seekerInvitations.expiresAt,
      respondedAt: schema.seekerInvitations.respondedAt,
      acceptedProfileId: schema.seekerInvitations.acceptedProfileId,
      acceptedHandle: schema.profiles.handle,
      acceptedDisplayName: schema.profiles.displayName,
    })
    .from(schema.seekerInvitations)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.seekerInvitations.acceptedProfileId),
    )
    .where(eq(schema.seekerInvitations.organizationId, session.orgId))
    .orderBy(desc(schema.seekerInvitations.createdAt))
    .limit(500);

  const mapRow = (r: (typeof rows)[number]): InviteListRow => ({
    id: r.id,
    email: r.email,
    name: r.name,
    profession: r.profession,
    state: r.state as InviteListRow["state"],
    declineReason: r.declineReason,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    acceptedHandle: r.acceptedHandle ?? null,
    acceptedDisplayName: r.acceptedDisplayName ?? null,
  });

  const all = rows.map(mapRow);
  return {
    pending: all.filter((r) => r.state === "pending"),
    joined: all.filter((r) => r.state === "accepted"),
    declined: all.filter((r) => r.state === "declined"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// loadInviteByToken  used by the public landing pages (no auth)
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadedInvite {
  id: string;
  email: string;
  name: string | null;
  profession: string | null;
  personalNote: string | null;
  orgName: string;
  state: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  expiresAt: string;
}

export async function loadInviteByToken(
  token: string,
): Promise<
  | { ok: true; invite: LoadedInvite }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "not_found" | "consumed" }
> {
  const tokenCheck = verifyInviteToken(token);
  if (!tokenCheck.ok) return { ok: false, reason: tokenCheck.reason };

  const db = getDb();
  const rows = await db
    .select({
      id: schema.seekerInvitations.id,
      email: schema.seekerInvitations.email,
      name: schema.seekerInvitations.name,
      profession: schema.seekerInvitations.profession,
      personalNote: schema.seekerInvitations.personalNote,
      state: schema.seekerInvitations.state,
      expiresAt: schema.seekerInvitations.expiresAt,
      orgName: schema.organizations.name,
    })
    .from(schema.seekerInvitations)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.seekerInvitations.organizationId),
    )
    .where(eq(schema.seekerInvitations.id, tokenCheck.inviteId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.state !== "pending") return { ok: false, reason: "consumed" };

  return {
    ok: true,
    invite: {
      id: row.id,
      email: row.email,
      name: row.name,
      profession: row.profession,
      personalNote: row.personalNote,
      orgName: row.orgName,
      state: row.state as LoadedInvite["state"],
      expiresAt: row.expiresAt.toISOString(),
    },
  };
}

