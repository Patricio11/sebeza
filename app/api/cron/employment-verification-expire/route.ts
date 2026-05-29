/**
 * Phase 9.23  nightly expiry sweep for employment-verification
 * requests.
 *
 * Flips `state='pending'` rows past `expires_at` to `state='expired'`,
 * redacts the encrypted contact email + clears the verification
 * token, fires `employment.verification.outcome` notification to the
 * seeker.
 *
 * POPIA D4: this is the final mechanism that ensures the contact's
 * email never persists past the 14-day window. If the contact
 * responds, the action handler redacts immediately; if they don't,
 * this cron redacts at expiry.
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}). Fail-
 * closed if the env var is unset.
 */

import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const ranAt = new Date();
  try {
    const db = getDb();
    const due = await db
      .select({
        id: schema.employmentVerifications.id,
        profileId: schema.employmentVerifications.profileId,
        profileUserId: schema.profiles.userId,
        contactName: schema.employmentVerifications.contactName,
        contactEmailHash: schema.employmentVerifications.contactEmailHash,
        employerOrgId: schema.employmentVerifications.employerOrgId,
        employerName: schema.organizations.name,
      })
      .from(schema.employmentVerifications)
      .innerJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.employmentVerifications.profileId),
      )
      .leftJoin(
        schema.organizations,
        eq(
          schema.organizations.id,
          schema.employmentVerifications.employerOrgId,
        ),
      )
      .where(
        and(
          eq(schema.employmentVerifications.state, "pending"),
          lt(schema.employmentVerifications.expiresAt, ranAt),
        ),
      );

    let fired = 0;
    for (const row of due) {
      try {
        await db
          .update(schema.employmentVerifications)
          .set({
            state: "expired",
            respondedAt: ranAt,
            contactEmailEnc: null,
            verificationToken: null,
          })
          .where(eq(schema.employmentVerifications.id, row.id));
        await logAccess({
          kind: "employment.verification.expired",
          actor: "system",
          subject: row.id,
          meta: {
            verificationId: row.id,
            employerOrgId: row.employerOrgId,
            contactEmailHash: row.contactEmailHash,
          },
        });
        await createNotification({
          userId: row.profileUserId,
          kind: "employment.verification.outcome",
          title: "Your verification request expired",
          body: `${row.contactName} at ${row.employerName ?? "the employer"} didn't respond within the 14-day window. Their email has been deleted from our records. You can submit a new request any time.`,
          link: "/dashboard/profile",
          meta: { verificationId: row.id, outcome: "expired" },
        });
        fired++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[cron.employment-verification-expire] failed for ${row.id}:`,
          e,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: ranAt.toISOString(),
      candidates: due.length,
      fired,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron.employment-verification-expire] failed:", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Cron failed.",
      },
      { status: 500 },
    );
  }
}
