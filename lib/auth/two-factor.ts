"use server";

/**
 * Phase 7 (Task 7.2)  Server Actions for the 2FA flow.
 *
 *   - enableTwoFactor({ password })  issues a TOTP secret + backup
 *     codes. Returns the otpauth URL (for the QR) and the plaintext
 *     backup codes (shown once on the setup page; never again).
 *   - confirmTwoFactor({ code })  verifies the first TOTP code; on
 *     success Better Auth flips `app_user.two_factor_enabled = true`.
 *   - verifyTotp({ code })  used by /verify-2fa after sign-in.
 *   - verifyBackupCode({ code })  recovery path on /verify-2fa.
 *   - disableTwoFactor({ password })  turn 2FA off from /account.
 *   - reset2faForUser({ userId, reason })  admin-only escape hatch
 *     when a user has lost both the device and the backup codes.
 */

import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { auth } from "./server";
import { roleHome } from "./guard";
import { verifyAdmin } from "./dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAccess } from "@/lib/audit";

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
// enableTwoFactor  first step: get the secret + backup codes
// ─────────────────────────────────────────────────────────────────────────────

const enableSchema = z.object({
  password: z.string().min(1, "Confirm your password."),
});

export async function enableTwoFactor(
  input: z.infer<typeof enableSchema>,
): Promise<
  ActionResult<{ totpURI: string; backupCodes: string[] }>
> {
  const parsed = enableSchema.safeParse(input);
  if (!parsed.success) return fail("Confirm your password.");

  try {
    const headers = await nextHeaders();
    const res = (await auth.api.enableTwoFactor({
      body: { password: parsed.data.password, issuer: "Sebenza" },
      headers,
      asResponse: false,
    })) as { totpURI: string; backupCodes: string[] };

    return ok({ totpURI: res.totpURI, backupCodes: res.backupCodes });
  } catch {
    return fail("That password didn't match. Try again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// confirmTwoFactor  verify the first TOTP code so the plugin flips
// `app_user.two_factor_enabled = true`. Until this succeeds, 2FA is
// "pending"  the plugin still requires confirmation before adding the
// `twoFactorRedirect` step to future sign-ins.
// ─────────────────────────────────────────────────────────────────────────────

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function confirmTwoFactor(
  input: z.infer<typeof codeSchema>,
): Promise<ActionResult> {
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid code.");

  try {
    const headers = await nextHeaders();
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers,
      asResponse: false,
    });
    revalidatePath("/employer/account");
    revalidatePath("/admin/account");
    revalidatePath("/dashboard/account");
    return ok();
  } catch {
    return fail("That code didn't match. Try the next one your app shows.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyTotp / verifyBackupCode  used on /verify-2fa
// ─────────────────────────────────────────────────────────────────────────────

const verifySchema = z.object({
  code: z.string().min(4).max(32),
  next: z.string().optional(),
});

export async function verifyTotp(
  input: z.infer<typeof verifySchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return fail("Enter the 6-digit code from your app.");

  try {
    const headers = await nextHeaders();
    const res = (await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers,
      asResponse: false,
    })) as { user?: { role?: string } };
    const role = (res.user?.role as "seeker" | "employer" | "admin") ?? "seeker";
    const next =
      parsed.data.next && parsed.data.next.startsWith("/")
        ? parsed.data.next
        : roleHome(role);
    return ok({ next });
  } catch {
    return fail("That code didn't match. Try the next one your app shows.");
  }
}

const backupSchema = z.object({
  code: z.string().min(8).max(64),
  next: z.string().optional(),
});

export async function verifyBackupCode(
  input: z.infer<typeof backupSchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) return fail("Backup codes are at least 8 characters.");

  try {
    const headers = await nextHeaders();
    const res = (await auth.api.verifyBackupCode({
      body: { code: parsed.data.code },
      headers,
      asResponse: false,
    })) as { user?: { role?: string } };
    const role = (res.user?.role as "seeker" | "employer" | "admin") ?? "seeker";
    const next =
      parsed.data.next && parsed.data.next.startsWith("/")
        ? parsed.data.next
        : roleHome(role);
    return ok({ next });
  } catch {
    return fail("Backup code didn't match. Try again or contact support.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// disableTwoFactor  turn 2FA off from /account (re-enrollment required
// after; the plugin clears `app_user.two_factor_enabled` and drops the
// `two_factor` row).
// ─────────────────────────────────────────────────────────────────────────────

const disableSchema = z.object({
  password: z.string().min(1, "Confirm your password."),
});

export async function disableTwoFactor(
  input: z.infer<typeof disableSchema>,
): Promise<ActionResult> {
  const parsed = disableSchema.safeParse(input);
  if (!parsed.success) return fail("Confirm your password.");

  try {
    const headers = await nextHeaders();
    await auth.api.disableTwoFactor({
      body: { password: parsed.data.password },
      headers,
      asResponse: false,
    });
    revalidatePath("/employer/account");
    revalidatePath("/admin/account");
    revalidatePath("/dashboard/account");
    return ok();
  } catch {
    return fail("That password didn't match. Try again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// reset2faForUser  admin escape hatch when a user loses device + codes.
// Wipes the user's `two_factor` row + flips `two_factor_enabled = false`
// so the next sign-in skips the 2FA step. If the user is employer/admin,
// the DAL forced-setup gate will immediately re-enrol them on next visit.
// ─────────────────────────────────────────────────────────────────────────────

const resetSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(10, "Reason must be at least 10 characters.").max(500),
});

export async function reset2faForUser(
  input: z.infer<typeof resetSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  if (parsed.data.userId === session.id) {
    return fail("Use your own /account panel to re-enrol your 2FA.");
  }

  const db = getDb();
  const userRows = await db
    .select({
      id: schema.appUser.id,
      email: schema.appUser.email,
      role: schema.appUser.role,
      twoFactorEnabled: schema.appUser.twoFactorEnabled,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, parsed.data.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return fail("User not found.");

  await db.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, user.id));
  await db
    .update(schema.appUser)
    .set({ twoFactorEnabled: false })
    .where(eq(schema.appUser.id, user.id));

  await logAccess({
    kind: "account.2fa.reset",
    actor: session.id,
    subject: user.id,
    meta: { email: user.email, role: user.role, reason: parsed.data.reason },
  });

  revalidatePath("/admin/users");
  return ok();
}
