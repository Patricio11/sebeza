/**
 * Phase 32.1.1 (security remediation)  INTERNAL employment-verification
 * helpers. **This module deliberately has NO `"use server"` directive.**
 *
 * Why it exists: `supersedeEmploymentVerifications` lived in
 * `employment-verification.ts`, which IS a `"use server"` module. Every
 * exported async function in such a file becomes a PUBLIC HTTP endpoint
 * with a stable action id  so an internal helper that trusts its
 * caller ("caller passes the profile id so we don't re-load the
 * session") was anonymously invokable, letting anyone flip a victim's
 * employment verification to `superseded`, redact the stored contact
 * email and fire a bogus notification. Destructive and irreversible.
 *
 * The fix is structural, not a patch: helpers that trust their caller
 * live in a plain module that cannot be reached over the wire. Same
 * pattern (and same rationale) as `lib/employer/invitations-cron.ts`.
 *
 * RULE FOR THIS FILE: nothing here performs its own authorisation, so
 * nothing here may ever be re-exported from a `"use server"` module.
 * Callers MUST have already established the caller's identity and the
 * ownership of the ids they pass.
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";

/**
 * Phase 9.23 D7  called from Phase 9.22's `updateCurrentEmployment`
 * when the seeker changes `current_employer_org_id`. Flips any
 * `pending` or `verified` verification for the PRIOR employer to
 * `state='superseded'`, redacts the contact email, fires the seeker
 * outcome notification (informational  no action required).
 *
 * **Trusts its arguments.** The only caller (`lib/profile/employment.ts`
 * → `updateCurrentEmployment`) is `verifyRole("seeker")`-gated and
 * derives `profileId` from the session, never from the request body.
 */
export async function supersedeEmploymentVerifications(args: {
  profileId: string;
  priorEmployerOrgId: string;
}): Promise<void> {
  const db = getDb();
  const active = await db
    .select({
      id: schema.employmentVerifications.id,
      state: schema.employmentVerifications.state,
      employerName: schema.organizations.name,
      profileUserId: schema.profiles.userId,
    })
    .from(schema.employmentVerifications)
    .leftJoin(
      schema.organizations,
      eq(
        schema.organizations.id,
        schema.employmentVerifications.employerOrgId,
      ),
    )
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.employmentVerifications.profileId),
    )
    .where(
      and(
        eq(schema.employmentVerifications.profileId, args.profileId),
        eq(
          schema.employmentVerifications.employerOrgId,
          args.priorEmployerOrgId,
        ),
        sql`${schema.employmentVerifications.state} IN ('pending', 'verified')`,
      ),
    );
  for (const row of active) {
    await db
      .update(schema.employmentVerifications)
      .set({
        state: "superseded",
        respondedAt: new Date(),
        contactEmailEnc: null,
        verificationToken: null,
      })
      .where(eq(schema.employmentVerifications.id, row.id));
    await logAccess({
      kind: "employment.verification.superseded",
      actor: "system",
      subject: row.id,
      meta: {
        verificationId: row.id,
        priorEmployerOrgId: args.priorEmployerOrgId,
      },
    });
    if (row.state === "verified") {
      try {
        await createNotification({
          userId: row.profileUserId,
          kind: "employment.verification.outcome",
          title: "Your employer-verified badge has been cleared",
          body: `You changed your current employer  the verified badge at ${row.employerName ?? "your previous employer"} no longer applies. You can request a new verification at your new employer any time.`,
          link: "/dashboard/profile",
          meta: { verificationId: row.id, outcome: "superseded" },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[employment-verification] supersede notify failed:", e);
      }
    }
  }
}
