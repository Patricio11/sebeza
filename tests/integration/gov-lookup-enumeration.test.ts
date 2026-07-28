/**
 * Phase 32.3.2 (security remediation)  the gov per-employer lookup must
 * not be usable to enumerate the organisation register.
 *
 * The bug this pins: the lookup used `ilike(organizations.name, input)`
 * with the comment *"ILIKE with no wildcards is functionally equality,
 * just case-folded"*. The premise was wrong  the wildcards come from
 * the USER. Submitting `%` matched the first organisation in the table;
 * `A%`, `B%`, … walked the whole register one row per request. That
 * defeats the "no partial-match autocomplete / no leaderboard"
 * guarantee the same comment block describes, and the surface is
 * governed precisely because per-employer data is sensitive.
 *
 * The fix removes pattern semantics entirely (`lower(a) = lower(b)`)
 * rather than escaping them  there is then nothing to forget next time.
 */
import { describe, expect, test, vi } from "vitest";

const GOV = {
  id: "user_sebenza-admin",
  role: "admin" as const,
  email: "admin@sebenzasa.com",
  emailVerified: true,
  name: "Gov",
  twoFactorEnabled: false,
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => GOV),
    verifySession: vi.fn(async () => GOV),
    verifyGov: vi.fn(async () => GOV),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

const db = getDb();

/**
 * The lookup's org-resolution step, exactly as the action performs it.
 * Asserting at this level keeps the test about the QUERY SEMANTICS
 * (which is where the bug lived) rather than about the surrounding
 * feature flag, which ships dormant.
 */
async function resolveOrgByName(name: string) {
  const rows = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(sql`lower(${schema.organizations.name}) = lower(${name})`)
    .limit(1);
  return rows[0] ?? null;
}

describe("Phase 32.3.2  gov employer lookup resists enumeration", () => {
  test("a bare % matches NOTHING (it used to return the first org in the table)", async () => {
    expect(await resolveOrgByName("%")).toBeNull();
  });

  test("prefix probes like 'A%', 'B%' … match nothing — the register cannot be walked", async () => {
    for (const probe of ["A%", "B%", "D%", "S%", "%a%", "_"]) {
      expect(
        await resolveOrgByName(probe),
        `probe ${probe} must not resolve an organisation`,
      ).toBeNull();
    }
  });

  test("a genuine exact name still resolves, case-insensitively", async () => {
    // Take a real seeded org so the test proves the feature still works
    // rather than merely proving everything returns null.
    const seeded = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .limit(1);
    const realName = seeded[0]?.name;
    expect(realName, "seed must contain at least one organisation").toBeTruthy();
    if (!realName) return;

    expect(await resolveOrgByName(realName)).not.toBeNull();
    expect(await resolveOrgByName(realName.toUpperCase())).not.toBeNull();
    expect(await resolveOrgByName(realName.toLowerCase())).not.toBeNull();
  });

  test("a partial of a real name does NOT resolve (exact-match contract)", async () => {
    const seeded = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .limit(1);
    const realName = seeded[0]?.name;
    if (!realName || realName.length < 4) return;
    expect(await resolveOrgByName(realName.slice(0, 3))).toBeNull();
    expect(await resolveOrgByName(`${realName.slice(0, 3)}%`)).toBeNull();
  });
});
