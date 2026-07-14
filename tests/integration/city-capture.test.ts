/**
 * Phase 21 (21.0)  city capture. The /search write path persists the full
 * `filters` object, so an employer search scoped to a city records that city in
 * `search_events.filters->>'city'` (province still always written). This is the
 * raw signal Phase 21.1 aggregates behind its k-anonymity + consent gates.
 */
import { afterAll, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { searchProfilesQuery } from "@/db/queries/profiles";

const db = getDb();
const MARKER = "zzcitycapturemarker";

afterAll(async () => {
  await db.delete(schema.searchEvents).where(eq(schema.searchEvents.terms, MARKER));
});

describe("city capture (Phase 21.0)", () => {
  test("a city-scoped search records the city in search_events.filters", async () => {
    await searchProfilesQuery({
      query: MARKER,
      province: "gauteng",
      city: "johannesburg",
    });

    const rows = await db
      .select({
        city: sql<string | null>`${schema.searchEvents.filters}->>'city'`,
        province: sql<string | null>`${schema.searchEvents.filters}->>'province'`,
      })
      .from(schema.searchEvents)
      .where(eq(schema.searchEvents.terms, MARKER))
      .limit(1);

    expect(rows.length).toBe(1);
    expect(rows[0]!.city).toBe("johannesburg");
    // Province is still captured (behaviour-preserving).
    expect(rows[0]!.province).toBe("gauteng");
  });
});
