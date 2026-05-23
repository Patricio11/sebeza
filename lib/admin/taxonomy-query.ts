/**
 * Phase 7  Read-side loaders for the admin taxonomy page.
 *
 * Lives separately from `lib/admin/taxonomy.ts` because that file is
 * `"use server"` (Server Actions only).
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/auth/dal";

export interface TaxonomyRowDb {
  slug: string;
  label: string;
  provinceSlug?: string;
  provinceLabel?: string;
}

export interface TaxonomyData {
  skills: TaxonomyRowDb[];
  professions: TaxonomyRowDb[];
  provinces: TaxonomyRowDb[];
  cities: TaxonomyRowDb[];
}

export async function loadTaxonomy(): Promise<TaxonomyData> {
  await verifyAdmin();
  const db = getDb();

  const [skillsRows, profRows, provRows, cityRows] = await Promise.all([
    db
      .select({ slug: schema.skills.slug, label: schema.skills.label })
      .from(schema.skills)
      .orderBy(asc(schema.skills.label)),
    db
      .select({ slug: schema.professions.slug, label: schema.professions.label })
      .from(schema.professions)
      .orderBy(asc(schema.professions.label)),
    db
      .select({ slug: schema.provinces.slug, label: schema.provinces.label })
      .from(schema.provinces)
      .orderBy(asc(schema.provinces.label)),
    db
      .select({
        slug: schema.cities.slug,
        label: schema.cities.label,
        provinceSlug: schema.cities.provinceSlug,
        provinceLabel: schema.provinces.label,
      })
      .from(schema.cities)
      .leftJoin(
        schema.provinces,
        eq(schema.provinces.slug, schema.cities.provinceSlug),
      )
      .orderBy(asc(schema.cities.label)),
  ]);

  return {
    skills: skillsRows,
    professions: profRows,
    provinces: provRows,
    cities: cityRows.map((c) => ({
      slug: c.slug,
      label: c.label,
      provinceSlug: c.provinceSlug,
      provinceLabel: c.provinceLabel ?? undefined,
    })),
  };
}
