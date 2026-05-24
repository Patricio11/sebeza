/**
 * Phase 9.8.3  server-side consent-state lookups.
 *
 * Single source of truth for "does this user/profile currently have
 * <purpose> granted?" Use these at the boundary of any action that
 * requires a specific consent  the invite action (9.8.4) calls
 * `hasVacancyMatchingConsent()` before writing an invitation row, and
 * the bulk-invite path splits selections into eligible/skipped with the
 * same helper. Keeping the read centralised here means a future change
 * to the consent model (e.g. consent expiry, re-grant prompts) lands
 * in one place, not scattered across action files.
 */

import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type { ConsentPurpose } from "@/lib/consent";

/**
 * Returns true iff the user has the given purpose currently in
 * `state='granted'`. Treats missing rows + `state='none'` + `state=
 * 'revoked'` as *not granted*  POPIA's affirmative-consent rule
 * means anything other than an explicit, current "granted" is a no.
 */
export async function hasConsent(
  userId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ state: schema.consents.state })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, userId),
        eq(schema.consents.purpose, purpose),
      ),
    )
    .limit(1);
  return row.length > 0 && row[0]!.state === "granted";
}

/**
 * Convenience for the 9.8.4 invite-action boundary. Mirrors the
 * `hasOutcomesResearchConsent` shape used by the analytics layer.
 */
export async function hasVacancyMatchingConsent(
  userId: string,
): Promise<boolean> {
  return hasConsent(userId, "vacancy_matching");
}
