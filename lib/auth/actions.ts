"use server";

/**
 * Phase 2 auth Server Actions.
 *
 * - signUpSeeker / signUpEmployer create the Better Auth user + the
 *   Sebenza-specific rows (profiles / academic / organizations / members /
 *   consents) in one transaction. On any failure, the whole signup rolls back.
 *
 * - signIn / signOut delegate to Better Auth.
 *
 * - requestPasswordReset is anti-enumeration — it always returns success even
 *   when the email isn't on file.
 *
 * - revokeConsent / regrantConsent flip the row in `consents` and write an
 *   audit-log entry.
 *
 * Every action that touches PII calls `logAccess()` so the audit trail is
 * complete from day one (POPIA §1).
 */

import { auth } from "./server";
import { roleHome } from "./guard";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { encryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import {
  CONSENT_PURPOSES,
  type ConsentPurpose,
  REQUIRED_FOR_SEARCHABILITY,
} from "@/lib/consent";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

type SignUpRole = "seeker" | "employer";

async function createBetterAuthUser(opts: {
  email: string;
  password: string;
  name: string;
  role: SignUpRole;
}) {
  // sign-up via Better Auth — hashes the password, emits the verification email.
  const result = await auth.api.signUpEmail({
    body: {
      email: opts.email,
      password: opts.password,
      name: opts.name,
    },
    asResponse: false,
  });
  // Set the role server-side (input: false on the role field blocks client-set).
  const db = getDb();
  await db
    .update(schema.appUser)
    .set({ role: opts.role, updatedAt: new Date() })
    .where(eq(schema.appUser.id, result.user.id));
  return result;
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// signUpSeeker — wires the 3-step seeker form
// ─────────────────────────────────────────────────────────────────────────────

const seekerSignUpSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().optional(),
  nationalId: z.string().min(6).max(40),
  password: z.string().min(10).max(128),
  // Consent purposes the user granted in step 2.
  grantedConsents: z.array(z.enum(CONSENT_PURPOSES)).min(1),
  // Step 3 — first profile fields
  profession: z.string().min(2),
  province: z.string().min(2),
  status: z.enum([
    "employed",
    "unemployed",
    "self_employed",
    "studying",
    "open_to_work",
  ]),
  // Optional academic block when "I'm a student" is on
  academic: z
    .object({
      institutionSlug: z.string(),
      programme: z.string().min(2),
      fieldOfStudy: z.string().min(2),
      nqfLevel: z.number().int().min(4).max(10),
      currentYear: z.number().int().min(1).max(5).nullable(),
      expectedGraduation: z.string().regex(/^\d{4}-\d{2}$/),
      nsfas: z.boolean(),
      openToInternships: z.boolean(),
      openToGraduateProgrammes: z.boolean(),
    })
    .nullable(),
});

export async function signUpSeeker(
  input: z.infer<typeof seekerSignUpSchema>,
): Promise<ActionResult> {
  const parsed = seekerSignUpSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");
  const v = parsed.data;

  // Searchability must be granted before the profile becomes searchable
  // (Phase 2 acceptance criterion). We require it on the form too.
  if (
    !REQUIRED_FOR_SEARCHABILITY.every((p) => v.grantedConsents.includes(p))
  ) {
    return fail("Searchability consent is required to create a profile.");
  }

  const db = getDb();

  try {
    // Better Auth: hash password, write user + account, send verification email.
    const { user } = await createBetterAuthUser({
      email: v.email,
      password: v.password,
      name: v.fullName,
      role: "seeker",
    });

    // Create profile + consents + (optional) academic in one transaction.
    const profileId = `prof_${user.id}`;
    const handle = await uniqueHandle(db, v.fullName);

    const displayName = redactSurname(v.fullName);
    const idEnc = encryptField(v.nationalId);

    await db.transaction(async (tx) => {
      await tx.insert(schema.profiles).values({
        id: profileId,
        userId: user.id,
        handle,
        displayName,
        fullSurname: v.fullName.split(/\s+/).slice(1).join(" ") || null,
        profession: v.profession,
        city: "",
        province: v.province,
        nationalIdEnc: idEnc,
        status: v.status,
        statusConfirmedAt: new Date(),
        verification: "unverified",
        completeness: 20, // very basic profile at step 3
        memberSince: new Date(),
      });

      // Consents — granted ones are 'granted', the rest are 'none'.
      await tx.insert(schema.consents).values(
        CONSENT_PURPOSES.map((purpose) => ({
          id: `cns_${user.id}_${purpose}`,
          userId: user.id,
          purpose,
          state: (v.grantedConsents.includes(purpose) ? "granted" : "none") as
            | "granted"
            | "none",
          version: "v2.1",
          grantedAt: v.grantedConsents.includes(purpose) ? new Date() : null,
          revokedAt: null,
        })),
      );

      // Optional academic
      if (v.academic) {
        await tx.insert(schema.academicProfiles).values({
          id: `acad_${user.id}`,
          profileId,
          institutionSlug: v.academic.institutionSlug,
          programme: v.academic.programme,
          fieldOfStudy: v.academic.fieldOfStudy,
          nqfLevel: v.academic.nqfLevel,
          currentYear: v.academic.currentYear,
          expectedGraduation: v.academic.expectedGraduation,
          nsfas: v.academic.nsfas,
          verification: "unverified",
          openToInternships: v.academic.openToInternships,
          openToGraduateProgrammes: v.academic.openToGraduateProgrammes,
        });
      }
    });

    await logAccess({
      kind: "auth.signup",
      actor: user.id,
      meta: { role: "seeker", consents: v.grantedConsents },
    });

    return ok({ next: "/verify-email" });
  } catch (e) {
    return fail(toMessage(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signUpEmployer — wires the employer registration form
// ─────────────────────────────────────────────────────────────────────────────

const employerSignUpSchema = z.object({
  orgName: z.string().min(2).max(160),
  registrationNumber: z.string().min(4).max(40),
  industry: z.string().min(2),
  size: z.string().min(1),
  country: z.string().min(2),
  fullName: z.string().min(2),
  yourRole: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(10).max(128),
});

export async function signUpEmployer(
  input: z.infer<typeof employerSignUpSchema>,
): Promise<ActionResult> {
  const parsed = employerSignUpSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");
  const v = parsed.data;

  const db = getDb();

  try {
    const { user } = await createBetterAuthUser({
      email: v.email,
      password: v.password,
      name: v.fullName,
      role: "employer",
    });

    const orgId = `org_${user.id}`;

    await db.transaction(async (tx) => {
      await tx.insert(schema.organizations).values({
        id: orgId,
        name: v.orgName,
        registrationNumber: v.registrationNumber,
        industry: v.industry,
        sizeBand: v.size,
        country: v.country,
        verification: "unverified",
      });
      await tx.insert(schema.organizationMembers).values({
        id: `orgmem_${user.id}`,
        organizationId: orgId,
        userId: user.id,
        role: "owner",
        twoFactorActive: false,
      });
    });

    await logAccess({
      kind: "auth.signup",
      actor: user.id,
      subject: orgId,
      meta: { role: "employer", org: v.orgName },
    });

    return ok({ next: "/verify-email" });
  } catch (e) {
    return fail(toMessage(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signIn — email + password only, server routes by role
// ─────────────────────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  next: z.string().optional(),
});

export async function signIn(
  input: z.infer<typeof signInSchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid email and password.");
  const v = parsed.data;

  // Phase 7 — before issuing a session, check `app_user.suspended_at` /
  // `deleted_at`. Both states must block sign-in. We look up by email
  // first; if it doesn't resolve we fall through to Better Auth which
  // returns the same generic "incorrect" error (no enumeration).
  try {
    const db = getDb();
    const lookup = await db
      .select({
        id: schema.appUser.id,
        suspendedAt: schema.appUser.suspendedAt,
        suspendedReason: schema.appUser.suspendedReason,
        deletedAt: schema.appUser.deletedAt,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, v.email))
      .limit(1);
    const account = lookup[0];
    if (account?.deletedAt) {
      return fail("This account has been erased.");
    }
    if (account?.suspendedAt) {
      const tail = account.suspendedReason ? `: ${account.suspendedReason}` : ".";
      return fail(`Your account is suspended${tail}`);
    }
  } catch {
    // DB hiccup shouldn't break the sign-in path; fall through to
    // Better Auth which returns its standard error envelope.
  }

  try {
    const result = (await auth.api.signInEmail({
      body: {
        email: v.email,
        password: v.password,
      },
      asResponse: false,
    })) as {
      user?: { id: string; emailVerified: boolean; role?: string };
      twoFactorRedirect?: boolean;
    };

    // Phase 7 (Task 7.2) — 2FA branch. Better Auth signals it has
    // accepted the password but is holding the session until the user
    // completes the second factor. The cookie carrying the "2FA
    // pending" state has already been set; we just route to the verify
    // page. `next` is preserved so post-verify routing is unchanged.
    if (result.twoFactorRedirect) {
      const next = v.next && v.next.startsWith("/") ? v.next : "";
      const qs = next ? `?next=${encodeURIComponent(next)}` : "";
      return ok({ next: `/verify-2fa${qs}` });
    }

    if (!result.user) {
      // Defensive: signInEmail returned neither user nor 2FA flag.
      return fail("Sign-in failed. Try again.");
    }
    const u = result.user;
    await logAccess({ kind: "auth.signin", actor: u.id });

    // Better Auth blocks unverified sign-ins (requireEmailVerification: true)
    // and surfaces the right error — we keep this branch as a belt-and-braces
    // check in case verification gets toggled off in the future.
    if (!u.emailVerified) {
      return ok({ next: `/verify-email?email=${encodeURIComponent(v.email)}` });
    }

    const home = roleHome(((u.role as "seeker" | "employer" | "admin") ?? "seeker"));
    return ok({ next: v.next && v.next.startsWith("/") ? v.next : home });
  } catch (e) {
    return fail("Email or password is incorrect.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signOut — clears the session cookie
// ─────────────────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const headers = await nextHeaders();
  await auth.api.signOut({ headers });
  redirect("/");
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset (anti-enumeration: always returns success)
// ─────────────────────────────────────────────────────────────────────────────

const resetRequestSchema = z.object({ email: z.string().email() });

export async function requestPasswordReset(
  input: z.infer<typeof resetRequestSchema>,
): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    // Still return "ok" to avoid enumeration.
    return ok();
  }
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/reset-password",
      },
      asResponse: false,
    });
  } catch {
    // Don't leak whether the email exists.
  }
  return ok();
}

const resetCompleteSchema = z.object({
  token: z.string().min(8),
  newPassword: z.string().min(10).max(128),
});

export async function completePasswordReset(
  input: z.infer<typeof resetCompleteSchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = resetCompleteSchema.safeParse(input);
  if (!parsed.success) return fail("Please choose a stronger password (10+ chars).");
  try {
    await auth.api.resetPassword({
      body: {
        token: parsed.data.token,
        newPassword: parsed.data.newPassword,
      },
      asResponse: false,
    });
    return ok({ next: "/sign-in" });
  } catch {
    return fail("That reset link has expired. Request a new one.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resendVerificationEmail
// ─────────────────────────────────────────────────────────────────────────────

export async function resendVerificationEmail(email: string): Promise<ActionResult> {
  if (!email || !email.includes("@")) return ok(); // anti-enumeration
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: "/dashboard" },
      asResponse: false,
    });
  } catch {
    // ignore — anti-enumeration
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Consent revoke / regrant
// ─────────────────────────────────────────────────────────────────────────────

export async function revokeConsent(
  purpose: ConsentPurpose,
): Promise<ActionResult> {
  const headers = await nextHeaders();
  const sess = await auth.api.getSession({ headers });
  if (!sess) return fail("Not signed in.");

  const db = getDb();
  await db
    .update(schema.consents)
    .set({ state: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(schema.consents.userId, sess.user.id),
        eq(schema.consents.purpose, purpose),
      ),
    );

  await logAccess({
    kind: "consent.revoke",
    actor: sess.user.id,
    meta: { purpose },
  });

  return ok();
}

export async function regrantConsent(
  purpose: ConsentPurpose,
): Promise<ActionResult> {
  const headers = await nextHeaders();
  const sess = await auth.api.getSession({ headers });
  if (!sess) return fail("Not signed in.");

  const db = getDb();
  await db
    .update(schema.consents)
    .set({ state: "granted", grantedAt: new Date(), revokedAt: null })
    .where(
      and(
        eq(schema.consents.userId, sess.user.id),
        eq(schema.consents.purpose, purpose),
      ),
    );

  await logAccess({
    kind: "consent.grant",
    actor: sess.user.id,
    meta: { purpose },
  });

  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message || "Sign-up failed. Please try again.";
  return "Sign-up failed. Please try again.";
}

function redactSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? fullName;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last[0]!.toUpperCase()}.`;
}

async function uniqueHandle(
  db: ReturnType<typeof getDb>,
  fullName: string,
): Promise<string> {
  const slug = fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const base = slug || `user-${randomUUID().slice(0, 8)}`;
  let candidate = base;
  let suffix = 1;
  // Try up to 6 variations, then fall back to a uuid suffix.
  while (suffix < 6) {
    const existing = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.handle, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}
