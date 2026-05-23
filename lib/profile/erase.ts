"use server";

/**
 * Phase 8 — Self-service POPIA §24 right to deletion.
 *
 * Mirrors the admin `eraseUser` flow: soft-delete via
 * `app_user.deleted_at`. The Phase 8 hard-delete cron sweeps the row
 * after the 30-day grace window. We sign the user out immediately so
 * the dashboard can't be visited again with a stale cookie.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { getSessionUser } from "@/lib/auth/dal";
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

const eraseSchema = z.object({
  /** Free text the seeker types to confirm. Must equal "ERASE" exactly. */
  confirm: z.string(),
});

export async function eraseMyAccount(
  input: z.infer<typeof eraseSchema>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  const parsed = eraseSchema.safeParse(input);
  if (!parsed.success) return fail("Confirmation required.");
  if (parsed.data.confirm !== "ERASE") {
    return fail("Type ERASE in capital letters to confirm.");
  }

  const db = getDb();
  await db
    .update(schema.appUser)
    .set({ deletedAt: new Date() })
    .where(eq(schema.appUser.id, session.id));

  await logAccess({
    kind: "account.self_erase",
    actor: session.id,
    subject: session.id,
    meta: { graceDays: 30 },
  });

  // Sign out immediately so the cookie doesn't keep a path open.
  try {
    const h = await nextHeaders();
    await auth.api.signOut({ headers: h });
  } catch {
    // Ignore — the user is soft-deleted regardless.
  }

  redirect("/");
  // Unreachable, but keeps the function signature honest.
  return ok();
}
