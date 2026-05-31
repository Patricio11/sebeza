"use server";

/**
 * Phase 11.4.3  preference Server Actions.
 *
 * Currently exposes `setDataSaverMode(enabled)`. The toggle flips the
 * column on `app_user`; subsequent server-rendered surfaces read it
 * via `shouldServeLight()`.
 *
 * No audit log: the data-saver preference is a UX choice, not a PII
 * touch  the privacy contract isn't affected.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function setDataSaverMode(
  enabled: boolean,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };

  const db = getDb();
  await db
    .update(schema.appUser)
    .set({ dataSaverMode: enabled })
    .where(eq(schema.appUser.id, session.id));

  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  return { ok: true };
}
