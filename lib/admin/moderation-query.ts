/**
 * Phase 7 — Read-side loaders for the admin moderation queue.
 *
 * Split from `lib/admin/moderation.ts` because that file is `"use server"`
 * (all exports must be Server Actions).
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { count, desc, eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/auth/dal";

export interface AdminOpenReport {
  id: string;
  subjectProfileId: string;
  subjectUserId: string | null;
  subjectHandle: string;
  reason: "fake_identity" | "inappropriate" | "harassment" | "spam" | "other";
  note: string | null;
  reporterUserId: string | null;
  createdAt: Date;
  /** Total open reports against this profile (for the badge). */
  totalAgainstSubject: number;
}

export async function listOpenReports(): Promise<AdminOpenReport[]> {
  await verifyAdmin();
  const db = getDb();

  const rows = await db
    .select({
      id: schema.reports.id,
      subjectProfileId: schema.reports.subjectProfileId,
      reason: schema.reports.reason,
      note: schema.reports.note,
      reporterUserId: schema.reports.reporterUserId,
      createdAt: schema.reports.createdAt,
      handle: schema.profiles.handle,
      subjectUserId: schema.profiles.userId,
    })
    .from(schema.reports)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.reports.subjectProfileId),
    )
    .where(eq(schema.reports.status, "open"))
    .orderBy(desc(schema.reports.createdAt))
    .limit(200);

  // Per-profile open-report counts, single query.
  const tallyRows = await db
    .select({
      subjectProfileId: schema.reports.subjectProfileId,
      c: count(),
    })
    .from(schema.reports)
    .where(eq(schema.reports.status, "open"))
    .groupBy(schema.reports.subjectProfileId);
  const tally = new Map(tallyRows.map((t) => [t.subjectProfileId, Number(t.c)]));

  return rows.map((r) => ({
    id: r.id,
    subjectProfileId: r.subjectProfileId,
    subjectUserId: r.subjectUserId ?? null,
    subjectHandle: r.handle ?? "deleted-profile",
    reason: r.reason as AdminOpenReport["reason"],
    note: r.note,
    reporterUserId: r.reporterUserId,
    createdAt: r.createdAt,
    totalAgainstSubject: tally.get(r.subjectProfileId) ?? 1,
  }));
}
