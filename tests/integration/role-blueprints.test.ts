/**
 * Role blueprints end to end on the harness (docs/ROLE_BLUEPRINTS_PLAN.md):
 * the seeded table feeds the Compass when the flag is on, a covered core
 * yields role recommendations instead of an empty page, the admin import
 * is idempotent and never overwrites an admin edit.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";

const ADMIN = {
  id: "user_sebenza-admin",
  role: "admin" as const,
  email: "admin@sebenzasa.com",
};

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return { ...original, verifyAdmin: vi.fn(async () => ADMIN) };
});

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getCompassForProfile } from "@/db/queries/career-compass";
import {
  getBlueprintRows,
  professionSlugForLabel,
} from "@/db/queries/blueprints";
import { findProfileByHandleQuery } from "@/db/queries/profiles";
import {
  importStarterBlueprints,
  upsertBlueprintRow,
} from "@/lib/admin/blueprints";
import { STARTER_BLUEPRINTS } from "@/lib/blueprints/catalogue";

const db = getDb();
const FLAG = "feature_flag_role_blueprints";

async function setFlag(on: boolean) {
  await db.execute(
    sql`INSERT INTO platform_settings (key, value) VALUES (${FLAG}, ${on ? "true" : "false"}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = ${on ? "true" : "false"}::jsonb`,
  );
}

beforeAll(async () => {
  await setFlag(true);
});
afterAll(async () => {
  await db
    .delete(schema.platformSettings)
    .where(eq(schema.platformSettings.key, FLAG));
  await db
    .update(schema.professionSkillBlueprints)
    .set({ tier: "next_level", track: "DevOps & Cloud", source: "seed" })
    .where(
      and(
        eq(
          schema.professionSkillBlueprints.professionSlug,
          "software-developer",
        ),
        eq(schema.professionSkillBlueprints.skillSlug, "docker"),
      ),
    );
});

describe("role blueprints", () => {
  test("the seed loaded the starter catalogue and every profession resolves", async () => {
    const { rows, source } = await getBlueprintRows("software-developer");
    expect(source).toBe("db");
    expect(
      rows.some((r) => r.skillSlug === "docker" && r.tier === "next_level"),
    ).toBe(true);
    expect(await professionSlugForLabel("Software Developer")).toBe(
      "software-developer",
    );
    expect(await professionSlugForLabel("software-developer")).toBe(
      "software-developer",
    );
    expect(await professionSlugForLabel("Astronaut")).toBeNull();
  });

  test("a covered core yields next-level role recommendations and a route map", async () => {
    const lerato = await findProfileByHandleQuery("lerato-n");
    expect(lerato).not.toBeNull();
    const compass = await getCompassForProfile(lerato!);
    expect(compass.routeMap).not.toBeNull();
    const map = compass.routeMap!;
    expect(map.core.length).toBeGreaterThan(0);
    expect(map.tracks.map((t) => t.name)).toContain("DevOps & Cloud");
    const roleRecs = compass.recommendations.filter((r) =>
      r.reason.startsWith("role_"),
    );
    expect(roleRecs.length).toBeGreaterThan(0);
    // Core gaps always lead; a next-level card names its track.
    const firstRole = compass.recommendations.find((r) =>
      r.reason.startsWith("role_"),
    );
    const anyCoreMissing = map.core.some((s) => !s.owned);
    if (anyCoreMissing)
      expect(compass.recommendations[0]?.reason).toBe("role_core");
    const next = roleRecs.find((r) => r.reason === "role_next_level");
    if (next) expect(next.track).toBeTruthy();
    expect(firstRole?.detail.length ?? 0).toBeGreaterThan(20);
  });

  test("admin import is idempotent and keeps admin edits", async () => {
    const edit = await upsertBlueprintRow({
      professionSlug: "software-developer",
      skillSlug: "docker",
      tier: "expected",
      track: null,
      proveIt: "Ship one container.",
    });
    expect(edit.ok).toBe(true);
    const imported = await importStarterBlueprints();
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.inserted).toBe(0);
      expect(imported.refreshed).toBeGreaterThan(0);
    }
    const [docker] = await db
      .select({
        tier: schema.professionSkillBlueprints.tier,
        source: schema.professionSkillBlueprints.source,
      })
      .from(schema.professionSkillBlueprints)
      .where(
        and(
          eq(
            schema.professionSkillBlueprints.professionSlug,
            "software-developer",
          ),
          eq(schema.professionSkillBlueprints.skillSlug, "docker"),
        ),
      );
    expect(docker).toMatchObject({ tier: "expected", source: "admin" });
    const total = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(schema.professionSkillBlueprints);
    expect(Number(total[0]?.n)).toBe(STARTER_BLUEPRINTS.length);
  });

  test("with the flag off the compass carries no route map", async () => {
    await setFlag(false);
    const lerato = await findProfileByHandleQuery("lerato-n");
    const compass = await getCompassForProfile(lerato!);
    expect(compass.routeMap ?? null).toBeNull();
    await setFlag(true);
  });
});
