/**
 * Phase 7 — Read-side loaders for the admin verification queue.
 *
 * Split from `lib/admin/verifications.ts` because that file is
 * `"use server"` (all exports must be Server Actions). These are plain
 * server-side loaders for `/admin/verifications`.
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/auth/dal";

export interface AdminPendingQualification {
  id: string;
  title: string;
  institution: string;
  awardedYear: number | null;
  candidateName: string;
  handle: string | null;
  submittedAt: Date | null;
  /** Phase 8 — latest SAQA job state, when any. NULL = never enqueued. */
  saqaJobStatus:
    | "queued"
    | "in_flight"
    | "verified"
    | "mismatch"
    | "error"
    | null;
  saqaJobSubmittedAt: Date | null;
}

export interface AdminPendingOrganisation {
  id: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  createdAt: Date | null;
}

export async function listPendingQualifications(): Promise<
  AdminPendingQualification[]
> {
  await verifyAdmin();
  const db = getDb();

  // Two queries: pending qualifications, and the latest SAQA job per
  // qualification when SAQA is in use. Merged in app code to keep the
  // SQL simple.
  const [rows, jobs] = await Promise.all([
    db
      .select({
        id: schema.qualifications.id,
        title: schema.qualifications.title,
        institution: schema.qualifications.institution,
        awardedYear: schema.qualifications.awardedYear,
        handle: schema.profiles.handle,
        candidateName: schema.profiles.displayName,
      })
      .from(schema.qualifications)
      .leftJoin(
        schema.profiles,
        eq(schema.profiles.id, schema.qualifications.profileId),
      )
      .where(eq(schema.qualifications.verification, "pending"))
      .orderBy(asc(schema.qualifications.id))
      .limit(100),
    db
      .select({
        qualificationId: schema.qualificationKycJobs.qualificationId,
        status: schema.qualificationKycJobs.status,
        submittedAt: schema.qualificationKycJobs.submittedAt,
        rowNumber: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.qualificationKycJobs.qualificationId} ORDER BY ${schema.qualificationKycJobs.submittedAt} DESC)`,
      })
      .from(schema.qualificationKycJobs)
      .orderBy(desc(schema.qualificationKycJobs.submittedAt)),
  ]);
  const latestJobByQualId = new Map(
    jobs.filter((j) => j.rowNumber === 1).map((j) => [j.qualificationId, j]),
  );

  return rows.map((r) => {
    const job = latestJobByQualId.get(r.id);
    return {
      id: r.id,
      title: r.title,
      institution: r.institution,
      awardedYear: r.awardedYear,
      candidateName: r.candidateName ?? "Unknown candidate",
      handle: r.handle,
      submittedAt: null,
      saqaJobStatus: (job?.status as AdminPendingQualification["saqaJobStatus"]) ?? null,
      saqaJobSubmittedAt: job?.submittedAt ?? null,
    };
  });
}

export async function listPendingOrganisations(): Promise<
  AdminPendingOrganisation[]
> {
  await verifyAdmin();
  const db = getDb();
  const rows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      registrationNumber: schema.organizations.registrationNumber,
      industry: schema.organizations.industry,
      createdAt: schema.organizations.createdAt,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.verification, "unverified"))
    .orderBy(asc(schema.organizations.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    registrationNumber: r.registrationNumber,
    industry: r.industry,
    createdAt: r.createdAt,
  }));
}
