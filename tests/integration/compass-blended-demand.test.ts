/**
 * COMPASS_FUEL_PLAN A4  blended demand, against the real database.
 *
 * Contracts:
 *   - demandBasis is returned ("local" | "national"); with the thin seed
 *     signal it resolves "national"
 *   - a skill demanded ONLY via vacancies/placements (zero searches)
 *     surfaces in recommendations  the old searches-only query could
 *     never find it
 *   - the weight math is exact: 1 open vacancy (×1.5) + 20 placements
 *     (×2.0) → demandSignal.searches === 42 (ROUND(1.5 + 40))
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getCompassForProfile } from "@/db/queries/career-compass";
import type { PublicProfile } from "@/lib/mock/types";

const db = getDb();
const SKILL = `test-blend-skill-${randomUUID().slice(0, 6)}`;
let vacancyId = "";
const placementIds: string[] = [];
let me: { handle: string; profession: string; province: string };

beforeAll(async () => {
  const [row] = await db
    .select({
      handle: schema.profiles.handle,
      profession: schema.profiles.profession,
      province: schema.profiles.province,
      id: schema.profiles.id,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, "andile-z"))
    .limit(1);
  if (!row) throw new Error("seed profile missing");
  me = row;

  const [user] = await db.select({ id: schema.appUser.id }).from(schema.appUser).limit(1);
  const [org] = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
  const [prof] = await db
    .select({ slug: schema.professions.slug })
    .from(schema.professions)
    .limit(1);
  if (!user || !org || !prof) throw new Error("seed rows missing");

  await db.insert(schema.skills).values({ slug: SKILL, label: `Blend Test ${SKILL}` });

  // Pin the vacancy to the seeker's own province so the LOCAL leg picks
  // up both the vacancy and its placements deterministically.
  const provRows = await db.execute(
    sql`SELECT slug FROM provinces
        WHERE LOWER(label) = LOWER(${row.province}) OR slug = LOWER(${row.province})
        LIMIT 1`,
  );
  const provinceSlug = (provRows as unknown as { rows: Array<{ slug: string }> })
    .rows[0]?.slug;
  if (!provinceSlug) throw new Error("province slug missing for seed profile");

  vacancyId = `vac_${randomUUID()}`;
  await db.insert(schema.vacancies).values({
    id: vacancyId,
    organizationId: org.id,
    createdByUserId: user.id,
    title: "Blend test vacancy",
    professionSlug: prof.slug,
    provinceSlug,
    skillSlugs: [SKILL],
    status: "open",
  });

  const [anyProfile] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .limit(1);
  for (let i = 0; i < 20; i++) {
    const id = `pl_${randomUUID()}`;
    placementIds.push(id);
    await db.insert(schema.placements).values({
      id,
      profileId: anyProfile!.id,
      organizationId: org.id,
      vacancyId,
      role: "Blend test",
      city: "Cape Town",
    });
  }
});

afterAll(async () => {
  await db.delete(schema.placements).where(inArray(schema.placements.id, placementIds));
  await db.delete(schema.vacancies).where(eq(schema.vacancies.id, vacancyId));
  await db.delete(schema.skills).where(eq(schema.skills.slug, SKILL));
});

describe("blended compass demand", () => {
  test("vacancy+placement demand surfaces with exact weight; basis returned", async () => {
    const compass = await getCompassForProfile({
      handle: me.handle,
      profession: me.profession,
      province: me.province,
      topSkills: [],
    } as unknown as PublicProfile);

    // Our in-province vacancy + 20 placements push the local signal
    // far past the floor, so the basis must resolve local.
    expect(compass.demandBasis).toBe("local");

    const rec = compass.recommendations.find((r) => r.skill.slug === SKILL);
    expect(rec, "vacancy/placement-only skill must be recommended").toBeTruthy();
    // 1 vacancy × 1.5 + 20 placements × 2.0 = 41.5 → ROUND → 42.
    expect(rec?.demandSignal?.searches).toBe(42);
  });
});

describe("search-event hygiene (2026-08-19 user report)", () => {
  test("crawler URL-template terms never reach the demand aggregates", async () => {
    // Simulate what Google's sitelinks-searchbox crawl used to write.
    const junkId = `srch_junk_${randomUUID()}`;
    await db.insert(schema.searchEvents).values({
      id: junkId,
      terms: "{search_term_string}",
      filters: {},
      resultCount: 0,
    });
    try {
      const rows = (
        (await db.execute(sql`
          SELECT LOWER(terms) AS term
          FROM search_events
          WHERE terms IS NOT NULL
            AND length(terms) >= 2
            AND terms !~ '[{}\<>]'
        `)) as unknown as { rows: Array<{ term: string }> }
      ).rows;
      expect(rows.some((r) => r.term.includes("search_term_string"))).toBe(false);
    } finally {
      await db.delete(schema.searchEvents).where(eq(schema.searchEvents.id, junkId));
    }
  });
});
