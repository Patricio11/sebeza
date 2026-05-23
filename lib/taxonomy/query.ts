/**
 * Phase 7 (A.4) — Public read-side loaders for the taxonomy.
 *
 * Sign-up forms + search filters read from these so adding a row in
 * /admin/taxonomy surfaces immediately, without a deploy or seed.
 * Falls back to the mock-data constants when the DB query returns
 * nothing (brand-new DB, mock-only dev).
 */

import "server-only";
import { unstable_cache } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { asc } from "drizzle-orm";
import { PROFESSIONS as MOCK_PROFESSIONS } from "@/lib/mock/taxonomy";

export interface TaxonomyOption {
  slug: string;
  label: string;
}

/**
 * Returns every profession in label order. Cached for 5 minutes — the
 * admin Server Actions in `lib/admin/taxonomy.ts` revalidate
 * `/admin/taxonomy`; new entries here surface on the next sign-up
 * page render within that window.
 */
export const getProfessions = unstable_cache(
  async (): Promise<TaxonomyOption[]> => {
    try {
      const db = getDb();
      const rows = await db
        .select({ slug: schema.professions.slug, label: schema.professions.label })
        .from(schema.professions)
        .orderBy(asc(schema.professions.label));
      if (rows.length > 0) return rows;
    } catch {
      // DB unavailable — fall through to the mock list so the form still renders.
    }
    return MOCK_PROFESSIONS.map((p) => ({ slug: p.slug, label: p.label }));
  },
  ["taxonomy.professions"],
  { revalidate: 300, tags: ["taxonomy"] },
);
