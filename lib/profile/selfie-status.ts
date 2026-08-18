/**
 * 2026-08  read helper for the live-selfie card on /dashboard/profile.
 * Separate from selfie.ts because that file is "use server" (actions
 * only); this is an ordinary server-side read.
 */

import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export async function getMySelfieVerifiedAt(
  profileId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ at: schema.profiles.selfieVerifiedAt })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1);
  return rows[0]?.at ? rows[0].at.toISOString() : null;
}
