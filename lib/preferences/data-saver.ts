/**
 * Phase 11.4.3  data-saver preference helpers.
 *
 * Two sources of truth:
 *   1. `app_user.data_saver_mode` (seeker-managed via /dashboard/account)
 *   2. Browser `Save-Data: on` header / `prefers-reduced-data` media query
 *
 * Browser signal is the FLOOR  if Save-Data: on is set, we downgrade
 * regardless of the seeker's account toggle. Account toggle is the
 * CEILING  if the seeker has opted in, we downgrade even when the
 * browser doesn't signal it.
 *
 * Returns true iff EITHER source is active. The downgrade is a single
 * boolean the caller branches on (no graduated levels per task scope).
 */

import "server-only";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

const REDUCED_DATA_HEADERS = ["save-data"];

/**
 * Read the data-saver flag from the seeker's `app_user` row + the
 * incoming request headers. Returns true when EITHER is active.
 *
 * Server-only by design; the conditional rendering happens on the
 * server so the bandwidth budget is enforced before bytes ship.
 */
export async function shouldServeLight(): Promise<boolean> {
  // Browser hint  cheap; check first.
  try {
    const h = await headers();
    for (const key of REDUCED_DATA_HEADERS) {
      const v = h.get(key);
      if (v && v.toLowerCase() === "on") return true;
    }
  } catch {
    // headers() can throw in render contexts that aren't request-scoped
    // (e.g. generateStaticParams). Fall through to the account toggle.
  }

  const session = await getSessionUser();
  if (!session) return false;
  const db = getDb();
  const row = await db
    .select({ flag: schema.appUser.dataSaverMode })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, session.id))
    .limit(1);
  return row[0]?.flag === true;
}

/**
 * Variant for non-server-component contexts (Route Handlers, Server
 * Actions) where we already have the user id. Skips the session read.
 */
export async function shouldServeLightForUser(
  userId: string,
): Promise<boolean> {
  try {
    const h = await headers();
    for (const key of REDUCED_DATA_HEADERS) {
      const v = h.get(key);
      if (v && v.toLowerCase() === "on") return true;
    }
  } catch {
    // fall through
  }
  const db = getDb();
  const row = await db
    .select({ flag: schema.appUser.dataSaverMode })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId))
    .limit(1);
  return row[0]?.flag === true;
}
