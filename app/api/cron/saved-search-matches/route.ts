/**
 * Phase 8  Daily saved-search match rollup.
 *
 * For every saved search, re-run the stored filters. Hash the sorted
 * set of result profile-ids and compare with `last_match_hash`. If new
 * profile-ids appeared, fire ONE `saved_search.new_matches` notification
 * to every org member (so the whole hiring team sees it) with the count.
 *
 * Storing the hash (not the result rows themselves) means saved-searches
 * stay snapshot-free  the search runs live every time. Hash drift =
 * new matches; rate-limit handled by the per-kind dedupe window in
 * `createNotification`.
 */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { searchProfilesQuery } from "@/db/queries/profiles";
import { notifyOrgMembers } from "@/lib/notifications/server";
import type { SearchFilters } from "@/lib/mock/types";

function hashProfileIds(ids: string[]): string {
  const sorted = [...ids].sort();
  return createHash("sha1").update(sorted.join(",")).digest("hex");
}

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const all = await db
    .select({
      id: schema.savedSearches.id,
      organizationId: schema.savedSearches.organizationId,
      name: schema.savedSearches.name,
      filters: schema.savedSearches.filters,
      lastMatchHash: schema.savedSearches.lastMatchHash,
    })
    .from(schema.savedSearches);

  const ran: { id: string; newCount: number; changed: boolean }[] = [];
  for (const s of all) {
    try {
      const result = await searchProfilesQuery(s.filters as SearchFilters);
      const ids = result.profiles.map((p) => p.handle);
      const nextHash = hashProfileIds(ids);
      const changed = nextHash !== s.lastMatchHash;

      // Compute the newly-appeared count cheaply: we don't store the
      // previous set, so we just notify on hash change with the total
      // matches today. Phase 8.x can swap this for an actual "new since
      // last run" count by also persisting the previous id set.
      await db
        .update(schema.savedSearches)
        .set({
          lastRunAt: new Date(),
          newMatchesCount: result.total,
          lastMatchHash: nextHash,
        })
        .where(eq(schema.savedSearches.id, s.id));

      if (changed && result.profiles.length > 0) {
        await notifyOrgMembers(s.organizationId, {
          kind: "saved_search.new_matches",
          title: `New matches on "${s.name}"`,
          body: `Your saved search now returns ${result.profiles.length} match${result.profiles.length === 1 ? "" : "es"}. Open the saved-searches page to review.`,
          link: "/employer/saved-searches",
          meta: {
            savedSearchId: s.id,
            savedSearchName: s.name,
            matchCount: result.profiles.length,
          },
          dedupeKey: s.id,
        });
      }

      ran.push({ id: s.id, newCount: result.profiles.length, changed });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[cron.saved-search-matches] failed for ${s.id}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    searchesProcessed: ran.length,
    searchesChanged: ran.filter((r) => r.changed).length,
  });
}
