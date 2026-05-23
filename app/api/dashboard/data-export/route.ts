/**
 * Phase 8  POPIA §23 right to data portability.
 *
 *   GET /api/dashboard/data-export
 *
 * Streams a JSON dump of every row in our DB that references the
 * signed-in seeker: app_user (sans password hash), profile, academic,
 * skills, experiences, qualifications, placements, consents, audit_log
 * (subject = userId OR profileId), notifications. The dump is the
 * seeker's by right; we audit-log the export as `account.data_export`.
 *
 * The encrypted national ID is included as ciphertext only  POPIA
 * doesn't require us to decrypt back. The seeker already has the
 * cleartext (it's their own ID number).
 */

import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  const db = getDb();

  const [userRows] = await Promise.all([
    db
      .select({
        id: schema.appUser.id,
        name: schema.appUser.name,
        email: schema.appUser.email,
        emailVerified: schema.appUser.emailVerified,
        role: schema.appUser.role,
        createdAt: schema.appUser.createdAt,
        updatedAt: schema.appUser.updatedAt,
        deletedAt: schema.appUser.deletedAt,
        twoFactorEnabled: schema.appUser.twoFactorEnabled,
        kycVerifiedAt: schema.appUser.kycVerifiedAt,
        notificationPrefs: schema.appUser.notificationPrefs,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, session.id))
      .limit(1),
  ]);

  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profileId = profile[0]?.id ?? null;

  const [academic, skills, experiences, quals, placements, consents, auditRows, notificationRows] =
    await Promise.all([
      profileId
        ? db
            .select()
            .from(schema.academicProfiles)
            .where(eq(schema.academicProfiles.profileId, profileId))
        : Promise.resolve([]),
      profileId
        ? db
            .select()
            .from(schema.profileSkills)
            .where(eq(schema.profileSkills.profileId, profileId))
        : Promise.resolve([]),
      profileId
        ? db
            .select()
            .from(schema.experiences)
            .where(eq(schema.experiences.profileId, profileId))
        : Promise.resolve([]),
      profileId
        ? db
            .select()
            .from(schema.qualifications)
            .where(eq(schema.qualifications.profileId, profileId))
        : Promise.resolve([]),
      profileId
        ? db
            .select()
            .from(schema.placements)
            .where(eq(schema.placements.profileId, profileId))
        : Promise.resolve([]),
      db
        .select()
        .from(schema.consents)
        .where(eq(schema.consents.userId, session.id)),
      db
        .select()
        .from(schema.auditLog)
        .where(
          or(
            eq(schema.auditLog.actor, session.id),
            profileId ? eq(schema.auditLog.subject, profileId) : eq(schema.auditLog.subject, session.id),
          ),
        ),
      db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, session.id)),
    ]);

  await logAccess({
    kind: "account.data_export",
    actor: session.id,
    subject: session.id,
    meta: {
      profileId,
      rowCounts: {
        academic: academic.length,
        skills: skills.length,
        experiences: experiences.length,
        qualifications: quals.length,
        placements: placements.length,
        consents: consents.length,
        audit: auditRows.length,
        notifications: notificationRows.length,
      },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    user: userRows[0] ?? null,
    profile: profile[0] ?? null,
    academic,
    skills,
    experiences,
    qualifications: quals,
    placements,
    consents,
    auditLog: auditRows,
    notifications: notificationRows,
    note:
      "POPIA §23 data export. National ID is shipped as ciphertext only; " +
      "the cleartext was provided by you at sign-up.",
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sebenza-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
