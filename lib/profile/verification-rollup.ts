/**
 * Phase 9.14  Seeker profile verification roll-up.
 *
 * `profiles.verification` is derived from the seeker's qualifications:
 *
 *   - verified   ⇔ at least one qualification is `verified`
 *   - pending    ⇔ no verified, but at least one qualification is `pending`
 *   - unverified ⇔ otherwise (no quals, or every qual is rejected/unverified)
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
        COUNT(*) FILTER (WHERE q.verification = 'verified')::int AS verified_count,
        COUNT(*) FILTER (WHERE q.verification = 'pending')::int AS pending_count
      FROM profiles p
      LEFT JOIN qualifications q ON q.profile_id = p.id
      WHERE p.id = ${profileId}
        AND p.deleted_at IS NULL
      GROUP BY p.verification
    `)) as unknown as {
      rows: Array<{
        current_verification: VerificationStatus;
        verified_count: number;
        pending_count: number;
      }>;
    }
  ).rows;
  const row = rows[0];
  if (!row) return null;

  const from = row.current_verification;
  const to: VerificationStatus =
    row.verified_count > 0
      ? "verified"
      : row.pending_count > 0
        ? "pending"
        : "unverified";

  if (from === to) return { changed: false, from, to };

  await db
    .update(schema.profiles)
    .set({ verification: to })
    .where(eq(schema.profiles.id, profileId));

  return { changed: true, from, to };
}
