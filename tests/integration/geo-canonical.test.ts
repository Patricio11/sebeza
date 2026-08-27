/**
 * Province / city labels are the ONE on-disk form
 * (docs/GEO_LABEL_CANONICAL_PLAN.md). After migrate-from-zero + seed no
 * profile may hold a slug, and the rank pool must answer the same for
 * "gauteng" and "Gauteng".
 */
import { describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import { rankInPoolQuery } from "@/db/queries/analytics";

const db = getDb();

function unwrap<T>(r: unknown): T[] {
  return Array.isArray(r) ? (r as T[]) : ((r as { rows: T[] }).rows ?? []);
}

describe("geo labels are canonical", () => {
  test("no seeded profile stores a province or city slug", async () => {
    const prov = unwrap<{ n: number }>(
      await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM profiles p
        JOIN provinces pr ON lower(p.province) IN (pr.slug, lower(pr.label))
        WHERE p.province <> pr.label
      `),
    );
    expect(prov[0]?.n ?? -1).toBe(0);
    const city = unwrap<{ n: number }>(
      await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM profiles p
        JOIN cities c ON lower(p.city) IN (c.slug, lower(c.label))
        WHERE p.city <> c.label
      `),
    );
    expect(city[0]?.n ?? -1).toBe(0);
  });

  test("rank pool answers the same for a province slug and its label", async () => {
    const byLabel = await rankInPoolQuery({
      handle: "lerato-n",
      profession: "Software Developer",
      province: "Gauteng",
    });
    const bySlug = await rankInPoolQuery({
      handle: "lerato-n",
      profession: "Software Developer",
      province: "gauteng",
    });
    expect(byLabel).not.toBeNull();
    expect(bySlug).toEqual(byLabel);
    expect(byLabel?.poolLabel).toBe("Software Developer · Gauteng");
    expect(byLabel?.poolTotal ?? 0).toBeGreaterThan(1);
  });
});
