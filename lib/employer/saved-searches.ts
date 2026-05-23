"use server";

/**
 * Phase 5 — Saved searches.
 *
 * Per-org: every member of the same organization shares the same saved
 * searches. Filters are stored as JSONB so we don't migrate every time
 * a new filter ships.
 *
 * `runSavedSearch` re-executes the stored filters against the live
 * profile pool and updates `newMatchesCount + lastRunAt` on the row.
 * We never snapshot the result set — a profile that gets removed later
 * would otherwise haunt the saved-search count forever.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { searchProfilesQuery } from "@/db/queries/profiles";
import type { SearchFilters } from "@/lib/mock/types";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────

const saveSearchSchema = z.object({
  name: z.string().min(2).max(120),
  filters: z.object({
    query: z.string().optional(),
    province: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    status: z
      .enum([
        "employed",
        "unemployed",
        "self_employed",
        "studying",
        "open_to_work",
      ])
      .nullable()
      .optional(),
    seniority: z
      .enum(["junior", "intermediate", "senior"])
      .nullable()
      .optional(),
    verification: z
      .enum(["unverified", "pending", "verified", "rejected"])
      .nullable()
      .optional(),
    highlightCitizens: z.boolean().optional(),
  }),
});

export async function saveSearch(
  input: z.infer<typeof saveSearchSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  const parsed = saveSearchSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");

  const db = getDb();
  const id = `srch_${randomUUID()}`;

  // Run the search once to populate the initial matches count.
  const initial = await searchProfilesQuery(parsed.data.filters as SearchFilters);

  await db.insert(schema.savedSearches).values({
    id,
    organizationId: session.orgId,
    createdByUserId: session.id,
    name: parsed.data.name,
    filters: parsed.data.filters,
    lastRunAt: new Date(),
    newMatchesCount: initial.total,
  });

  await logAccess({
    kind: "search.saved",
    actor: session.id,
    subject: id,
    meta: { orgId: session.orgId, name: parsed.data.name },
  });

  revalidatePath("/employer/saved-searches");
  return ok({ id });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runSavedSearch(input: {
  id: string;
}): Promise<ActionResult<{ count: number }>> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  if (!input?.id) return fail("Missing saved-search id.");

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.savedSearches)
    .where(
      and(
        eq(schema.savedSearches.id, input.id),
        eq(schema.savedSearches.organizationId, session.orgId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Saved search not found.");

  const result = await searchProfilesQuery(row.filters as SearchFilters);

  await db
    .update(schema.savedSearches)
    .set({ lastRunAt: new Date(), newMatchesCount: result.total })
    .where(eq(schema.savedSearches.id, row.id));

  await logAccess({
    kind: "search.saved.run",
    actor: session.id,
    subject: row.id,
    meta: { orgId: session.orgId, count: result.total },
  });

  revalidatePath("/employer/saved-searches");
  return ok({ count: result.total });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function deleteSavedSearch(input: {
  id: string;
}): Promise<ActionResult> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  if (!input?.id) return fail("Missing saved-search id.");

  const db = getDb();
  const result = await db
    .delete(schema.savedSearches)
    .where(
      and(
        eq(schema.savedSearches.id, input.id),
        eq(schema.savedSearches.organizationId, session.orgId),
      ),
    );
  void result;

  await logAccess({
    kind: "search.saved.delete",
    actor: session.id,
    subject: input.id,
    meta: { orgId: session.orgId },
  });

  revalidatePath("/employer/saved-searches");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader (server-side helper for the page; not a Server Action since it
// doesn't mutate — exposed as a regular async fn).
// ─────────────────────────────────────────────────────────────────────────────

export interface SavedSearchRow {
  id: string;
  name: string;
  filters: SearchFilters;
  createdAt: string;
  lastRunAt: string | null;
  newMatchesCount: number;
  createdByUserId: string;
}

export async function loadSavedSearches(): Promise<SavedSearchRow[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.organizationId, session.orgId))
    .orderBy(desc(schema.savedSearches.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    filters: r.filters as SearchFilters,
    createdAt: r.createdAt.toISOString(),
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    newMatchesCount: r.newMatchesCount,
    createdByUserId: r.createdByUserId,
  }));
}
