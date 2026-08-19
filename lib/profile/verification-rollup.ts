/**
 * Phase 9.14  Seeker profile verification roll-up.
 *
 * `profiles.verification` answers exactly ONE question: is this a real
 * person? (founder decision 2026-08-19, after a seeker showed Verified
 * without ever doing the check):
 *
 *   - verified   ⇔ the live selfie was completed
 *   - unverified ⇔ otherwise
 *
 * Qualification verification is a DIFFERENT claim ("a credential was
 * checked") and stays where it belongs: on the qualification row, which
 * already renders its own badge. One label, one meaning  the
 * Verification-Honesty rule applied to the badge itself.
 *
 * `rejected` is NEVER auto-applied to a profile  rejection is per-
 * qualification only; a seeker isn't "rejected" as a person just
 * because one document was. The Verification-Honesty Rule lands on
 * this contract: every badge state is structurally derivable from
 * something the seeker actually did.
 *
 * Pure derivation  the function is idempotent + safe to re-run.
 * Callers (admin + seeker mutation sites for qualifications) hit
 * this AFTER their own mutation has landed, so the next read sees
 * the consistent profile-level state.
 */

import "server-only";
import { sql, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type { VerificationStatus } from "@/lib/mock/types";

/**
 * Recompute + write `profiles.verification` based on the current
 * qualification rows for that profile. Returns whether the value
 * actually changed (so callers can opt to audit-log only on actual
 * transitions).
 *
 * No-op if the profileId is missing or the profile is soft-deleted.
 */
export async function recomputeProfileVerification(
  profileId: string | null | undefined,
): Promise<{ changed: boolean; from: VerificationStatus; to: VerificationStatus } | null> {
  if (!profileId) return null;
  const db = getDb();

  // One round trip: current profile.verification + a count per qual state.
  const rows = (
    (await db.execute(sql`
      SELECT
        p.verification AS current_verification,
        (p.selfie_verified_at IS NOT NULL) AS selfie_verified
      FROM profiles p
      WHERE p.id = ${profileId}
        AND p.deleted_at IS NULL
    `)) as unknown as {
      rows: Array<{
        current_verification: VerificationStatus;
        selfie_verified: boolean;
      }>;
    }
  ).rows;
  const row = rows[0];
  if (!row) return null;

  const from = row.current_verification;
  const to: VerificationStatus = row.selfie_verified ? "verified" : "unverified";

  if (from === to) return { changed: false, from, to };

  await db
    .update(schema.profiles)
    .set({ verification: to })
    .where(eq(schema.profiles.id, profileId));

  return { changed: true, from, to };
}
