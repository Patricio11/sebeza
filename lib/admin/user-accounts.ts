"use server";

/**
 * Account-directory write actions (2026-08): create + edit.
 *
 *   - createAdminAccount  admins are ISSUED, never self-registered
 *     (auth.signUp.adminNotice has said so since Phase 2). The account is
 *     created with a random unusable password and the new admin receives a
 *     set-password email; the DAL's forced-2FA gate enrols them on first
 *     sign-in. Seekers and employers are deliberately NOT creatable here:
 *     their sign-up flows are consent ceremonies (POPIA) that an admin
 *     cannot perform on someone's behalf.
 *
 *   - adminEditUser  corrections to name/email (support cases: a typo'd
 *     address that can never receive its verification link, a name change).
 *     An email change resets emailVerified and sends a fresh verification
 *     link to the NEW address; before/after values land in the audit log.
 *
 * Both actions are `"use server"` exports and therefore PUBLIC HTTP
 * endpoints (Phase 32 lesson): verifyAdmin() is the first await in each.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { auth } from "@/lib/auth/server";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

const ok = <T extends object>(extra?: T): { ok: true } & T =>
  ({ ok: true, ...(extra ?? ({} as T)) });
const fail = (message: string): { ok: false; message: string } => ({
  ok: false,
  message,
});

// ─────────────────────────────────────────────────────────────────────────────
// createAdminAccount
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export async function createAdminAccount(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { fullName, email } = parsed.data;

  const db = getDb();
  const existing = await db
    .select({ id: schema.appUser.id })
    .from(schema.appUser)
    .where(eq(schema.appUser.email, email))
    .limit(1);
  if (existing.length > 0) {
    return fail("An account with that email already exists.");
  }

  // Random unusable password: the invitee sets their own via the reset
  // link. Never displayed, never logged.
  const userId = randomUUID();
  const pwHash = await hashPassword(randomBytes(32).toString("base64url"));

  await db.insert(schema.appUser).values({
    id: userId,
    name: fullName,
    email,
    // The set-password email proves control of the inbox, and the reset
    // flow only works for the address on file.
    emailVerified: true,
    role: "admin",
  });
  await db.insert(schema.account).values({
    id: `acc_${userId}`,
    accountId: userId, // Better Auth pattern: accountId = userId for credentials
    providerId: "credential",
    userId,
    password: pwHash,
  });

  // Deliver the set-password invitation through the existing reset flow.
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      asResponse: false,
    });
  } catch {
    // The account exists either way; the invitee can use "forgot password"
    // themselves. Don't fail the creation over a mailer hiccup.
  }

  await logAccess({
    kind: "account.admin.create",
    actor: session.id,
    subject: userId,
    meta: { email, fullName },
  });

  revalidatePath("/admin/users");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// adminEditUser
// ─────────────────────────────────────────────────────────────────────────────

const editSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export async function adminEditUser(
  input: z.infer<typeof editSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { userId, fullName, email } = parsed.data;

  const db = getDb();
  const rows = await db
    .select({
      id: schema.appUser.id,
      name: schema.appUser.name,
      email: schema.appUser.email,
      deletedAt: schema.appUser.deletedAt,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("User not found.");
  if (user.deletedAt) {
    return fail("This account has been erased and can no longer be edited.");
  }

  const emailChanged = email !== user.email.toLowerCase();
  const nameChanged = fullName !== user.name;
  if (!emailChanged && !nameChanged) return ok();

  if (emailChanged) {
    const clash = await db
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email))
      .limit(1);
    if (clash.length > 0) {
      return fail("Another account already uses that email.");
    }
  }

  await db
    .update(schema.appUser)
    .set({
      name: fullName,
      email,
      // A changed address must prove itself again.
      ...(emailChanged ? { emailVerified: false } : {}),
    })
    .where(eq(schema.appUser.id, userId));

  if (emailChanged) {
    try {
      await auth.api.sendVerificationEmail({
        body: { email, callbackURL: "/dashboard" },
        asResponse: false,
      });
    } catch {
      // Non-fatal: the user can resend from /verify-email.
    }
  }

  await logAccess({
    kind: "account.edit",
    actor: session.id,
    subject: userId,
    meta: {
      before: { name: user.name, email: user.email },
      after: { name: fullName, email },
      emailChanged,
    },
  });

  revalidatePath("/admin/users");
  return ok();
}
