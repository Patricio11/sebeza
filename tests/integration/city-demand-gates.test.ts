/**
 * Phase 21.1 ("Hyper-Local Demand") — the privacy gates on city-level demand.
 *
 * City-level cuts only surface for top-5-metro seekers who consent to research
 * insights, and only for segments above the thin-cell floor. This proves each
 * gate suppresses, and that a real metro + consent yields floor-respecting
 * hotspots. The flag itself is exercised end-to-end (fresh request per load) in
 * the 21.2 E2E; here we hold it ON and test the metro / consent / floor gates.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  getCityDemandHotspots,
  CITY_DEMAND_FLOOR,
} from "@/db/queries/city-demand";

const db = getDb();
const FLAG = "feature_flag_city_demand";
const LOW_TERM = "Zzlowfloorjob";

let consentingUserId = "";
let nonConsentingUserId = "";

beforeAll(async () => {
  await db
    .insert(schema.platformSettings)
    .values({ key: FLAG, value: true })
    .onConflictDoUpdate({
      target: schema.platformSettings.key,
      set: { value: true },
    });

  const [andile] = await db
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, "andile-z"))
    .limit(1);
  consentingUserId = andile?.userId ?? "";

  const nonConsent = await db.execute(sql`
    SELECT p.user_id FROM profiles p
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM consents c
        WHERE c.user_id = p.user_id
          AND c.purpose = 'outcomes_research'
          AND c.state = 'granted'
      )
    LIMIT 1
  `);
  nonConsentingUserId =
    (nonConsent as unknown as { rows: { user_id: string }[] }).rows[0]
      ?.user_id ?? "";

  // A below-floor Johannesburg segment that must never surface.
  for (let i = 0; i < CITY_DEMAND_FLOOR - 2; i++) {
    await db.execute(sql`
      INSERT INTO search_events (id, terms, filters, result_count)
      VALUES (${"se_lowfloor_" + i}, ${LOW_TERM}, ${sql`'{"province":"gauteng","city":"johannesburg"}'::jsonb`}, 3)
      ON CONFLICT (id) DO NOTHING
    `);
  }
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM search_events WHERE terms = ${LOW_TERM}`);
  await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, FLAG));
});

describe("city demand gates (Phase 21.1)", () => {
  test("metro + consent + flag → floor-respecting hotspots", async () => {
    const result = await getCityDemandHotspots({
      cityLabel: "Johannesburg",
      userId: consentingUserId,
    });
    expect(result).not.toBeNull();
    expect(result!.hotspots.length).toBeGreaterThan(0);
    for (const h of result!.hotspots) {
      expect(h.searches).toBeGreaterThanOrEqual(CITY_DEMAND_FLOOR);
    }
    // The below-floor segment is suppressed.
    expect(result!.hotspots.some((h) => h.label === LOW_TERM)).toBe(false);
  });

  test("non-metro city → null (no city-level cut for small towns)", async () => {
    const result = await getCityDemandHotspots({
      cityLabel: "Welkom",
      userId: consentingUserId,
    });
    expect(result).toBeNull();
  });

  test("no research consent → null", async () => {
    expect(nonConsentingUserId).not.toBe("");
    const result = await getCityDemandHotspots({
      cityLabel: "Johannesburg",
      userId: nonConsentingUserId,
    });
    expect(result).toBeNull();
  });
});
