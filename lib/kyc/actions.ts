"use server";

/**
 * Phase 8  KYC Server Actions.
 *
 *   - submitMyIdForVerification: seeker-side. Reads the encrypted ID
 *     off `profiles.nationalIdEnc`, decrypts in-memory, hands to the
 *     resolved provider, writes the result back.
 *   - adminVerifyIdManually: admin-side escape hatch when the SaaS
 *     flag is off (default)  admin can still approve based on
 *     out-of-band documents.
 *   - revokeMyKyc: seeker can clear their own verification.
 *
 * Every action audit-logs `kyc.verify` / `kyc.revoke` with the
 * provider name (so a future admin reviewing the trail can see whether
 * the mark came from the SaaS or a manual approval).
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { decryptField } from "@/lib/crypto";
import { resolveIdentityVerifier } from "./provider";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

export async function submitMyIdForVerification(): Promise<
  ActionResult<{ status: string; provider: string }>
> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const db = getDb();

  const profile = await db
    .select({
      id: schema.profiles.id,
      userId: schema.profiles.userId,
      displayName: schema.profiles.displayName,
      nationalIdEnc: schema.profiles.nationalIdEnc,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const me = profile[0];
  if (!me) return fail("Profile not found.");
  if (!me.nationalIdEnc) {
    return fail(
      "No ID on file. Add your national ID first (Profile editor → National ID).",
    );
  }

  let idNumber: string;
  try {
    idNumber = decryptField(me.nationalIdEnc);
  } catch {
    return fail("ID decryption failed. Please re-enter your ID.");
  }

  const verifier = await resolveIdentityVerifier();
  const result = await verifier.verify({
    idNumber,
    fullName: me.displayName,
  });
  if (!result.ok) return fail(result.message);

  // Record the outcome. "pending" means the provider needs more time
  // (or  when running the mock  admin manual approval is required).
  // "verified" updates the user-level columns + audit-logs with the
  // provider transaction id.
  if (result.status === "verified") {
    await db
      .update(schema.appUser)
      .set({
        kycTransactionId: result.providerTransactionId,
        kycVerifiedAt: new Date(),
      })
      .where(eq(schema.appUser.id, session.id));
  }

  await logAccess({
    kind: "kyc.verify",
    actor: session.id,
    subject: me.id,
    meta: {
      provider: verifier.name,
      status: result.status,
      providerTransactionId: result.providerTransactionId,
    },
  });

  revalidatePath("/dashboard/profile");
  return ok({ status: result.status, provider: verifier.name });
}

const adminVerifyIdSchema = z.object({
  userId: z.string().min(1),
  note: z.string().min(5).max(280),
});

export async function adminVerifyIdManually(
  input: z.infer<typeof adminVerifyIdSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = adminVerifyIdSchema.safeParse(input);
  if (!parsed.success) return fail("Add a note (5+ chars).");
  const db = getDb();
  const rows = await db
    .select({ id: schema.appUser.id, email: schema.appUser.email })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, parsed.data.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("User not found.");

  await db
    .update(schema.appUser)
    .set({
      kycTransactionId: `manual:${session.id}`,
      kycVerifiedAt: new Date(),
    })
    .where(eq(schema.appUser.id, user.id));

  await logAccess({
    kind: "kyc.verify",
    actor: session.id,
    subject: user.id,
    meta: { provider: "manual", note: parsed.data.note, email: user.email },
  });

  revalidatePath("/admin/users");
  return ok();
}

export async function revokeMyKyc(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const db = getDb();
  await db
    .update(schema.appUser)
    .set({ kycTransactionId: null, kycVerifiedAt: null })
    .where(eq(schema.appUser.id, session.id));
  await logAccess({
    kind: "kyc.revoke",
    actor: session.id,
    subject: session.id,
  });
  revalidatePath("/dashboard/profile");
  return ok();
}
