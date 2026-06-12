/**
 * Phase 12 (Task 12.2) — search filters + visibility exclusions against
 * the real database.
 *
 * Filters: work-availability `&&` overlap, minYears ("unknown is not a
 * pass", 9.19 D2), any-province semantics live at the vacancy matcher.
 * Exclusions: searchability pause (11.3.1), seeker-blocks-employer
 * (11.3.2, keyed on callerOrgId), and the Phase 12 suspended-account
 * exclusion (search + public dossier) added after these fixtures
 * surfaced the gap.
 *
 * Every mutation restores seed state in afterAll/afterEach so the other
 * sequential integration files see the seeded baseline.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  findProfileByHandleQuery,
  searchProfilesQuery,
} from "@/db/queries/profiles";

const db = getDb();

let subjectHandle: string;
let subjectUserId: string;
let subjectProfileId: string;

beforeAll(async () => {
  const { profiles } = await searchProfilesQuery({});
  expect(profiles.length).toBeGreaterThan(2);
  const subject = profiles[2]!;
  subjectHandle = subject.handle;
  const r = (await db.execute(
    sql`SELECT id, user_id FROM profiles WHERE handle = ${subjectHandle}`,
  )) as unknown as { rows: Array<{ id: string; user_id: string }> };
  subjectProfileId = r.rows[0]!.id;
  subjectUserId = r.rows[0]!.user_id;
});

describe("filters", () => {
  test("work-availability overlap: matching mode includes, disjoint mode excludes", async () => {
    const saved = (await db.execute(
      sql`SELECT work_availability::text AS wa FROM profiles WHERE handle = ${subjectHandle}`,
    )) as unknown as { rows: Array<{ wa: string | null }> };
    try {
      await db.execute(
        sql`UPDATE profiles SET work_availability = ARRAY['seasonal']::work_availability_kind[]
            WHERE handle = ${subjectHandle}`,
      );
      const seasonal = await searchProfilesQuery({
        availableFor: ["seasonal"],
      });
      expect(seasonal.profiles.map((p) => p.handle)).toContain(subjectHandle);

      const remoteOnly = await searchProfilesQuery({
        availableFor: ["remote"],
      });
      expect(remoteOnly.profiles.map((p) => p.handle)).not.toContain(
        subjectHandle,
      );
    } finally {
      await db.execute(
        sql`UPDATE profiles SET work_availability = ${saved.rows[0]!.wa}::work_availability_kind[]
            WHERE handle = ${subjectHandle}`,
      );
    }
  });

  test("minYears floor: NULL years is not a pass (9.19 D2)", async () => {
    const saved = (await db.execute(
      sql`SELECT years_experience FROM profiles WHERE handle = ${subjectHandle}`,
    )) as unknown as { rows: Array<{ years_experience: number | null }> };
    try {
      await db.execute(
        sql`UPDATE profiles SET years_experience = NULL WHERE handle = ${subjectHandle}`,
      );
      const floored = await searchProfilesQuery({ minYearsExperience: 1 });
      expect(
        floored.profiles.map((p) => p.handle),
        "NULL years must NOT pass a floor",
      ).not.toContain(subjectHandle);

      await db.execute(
        sql`UPDATE profiles SET years_experience = 7 WHERE handle = ${subjectHandle}`,
      );
      const passing = await searchProfilesQuery({ minYearsExperience: 5 });
      expect(passing.profiles.map((p) => p.handle)).toContain(subjectHandle);
    } finally {
      await db.execute(
        sql`UPDATE profiles SET years_experience = ${saved.rows[0]!.years_experience}
            WHERE handle = ${subjectHandle}`,
      );
    }
  });
});

describe("exclusion: searchability pause (11.3.1)", () => {
  afterAll(async () => {
    await db.execute(
      sql`UPDATE consents SET paused_until = NULL, paused_at = NULL, paused_reason = NULL
          WHERE user_id = ${subjectUserId} AND purpose = 'searchability'`,
    );
  });

  test("paused profile vanishes; expired pause restores visibility", async () => {
    await db.execute(
      sql`UPDATE consents SET paused_until = now() + interval '7 days', paused_at = now()
          WHERE user_id = ${subjectUserId} AND purpose = 'searchability'`,
    );
    const paused = await searchProfilesQuery({});
    expect(paused.profiles.map((p) => p.handle)).not.toContain(subjectHandle);

    await db.execute(
      sql`UPDATE consents SET paused_until = now() - interval '1 hour'
          WHERE user_id = ${subjectUserId} AND purpose = 'searchability'`,
    );
    const expired = await searchProfilesQuery({});
    expect(expired.profiles.map((p) => p.handle)).toContain(subjectHandle);
  });
});

describe("exclusion: seeker blocks employer (11.3.2)", () => {
  const ORG = "org_discovery-bank";

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM seeker_blocked_employers WHERE profile_id = ${subjectProfileId}`,
    );
  });

  test("blocked org's search excludes the profile; everyone else still sees it", async () => {
    await db.execute(
      sql`INSERT INTO seeker_blocked_employers (id, profile_id, org_id)
          VALUES (${randomUUID()}, ${subjectProfileId}, ${ORG})`,
    );

    const asBlockedOrg = await searchProfilesQuery({ callerOrgId: ORG });
    expect(asBlockedOrg.profiles.map((p) => p.handle)).not.toContain(
      subjectHandle,
    );

    // Anonymous / gov / admin callers (no callerOrgId) are unaffected —
    // the block is private to the seeker-org pair (D2 invariant).
    const anonymous = await searchProfilesQuery({});
    expect(anonymous.profiles.map((p) => p.handle)).toContain(subjectHandle);

    // A different org is unaffected too.
    const otherOrg = await searchProfilesQuery({ callerOrgId: "org_other" });
    expect(otherOrg.profiles.map((p) => p.handle)).toContain(subjectHandle);
  });
});

describe("exclusion: suspended account (Phase 12 fix)", () => {
  afterAll(async () => {
    await db.execute(
      sql`UPDATE app_user SET suspended_at = NULL, suspended_reason = NULL
          WHERE id = ${subjectUserId}`,
    );
  });

  test("suspension removes the profile from search AND the public dossier; restore brings it back", async () => {
    await db.execute(
      sql`UPDATE app_user SET suspended_at = now(), suspended_reason = 'phase12 fixture'
          WHERE id = ${subjectUserId}`,
    );

    const search = await searchProfilesQuery({});
    expect(
      search.profiles.map((p) => p.handle),
      "suspended profile must not surface in search",
    ).not.toContain(subjectHandle);

    expect(
      await findProfileByHandleQuery(subjectHandle),
      "suspended profile's public dossier must go dark",
    ).toBeNull();

    await db.execute(
      sql`UPDATE app_user SET suspended_at = NULL, suspended_reason = NULL
          WHERE id = ${subjectUserId}`,
    );
    const restored = await searchProfilesQuery({});
    expect(restored.profiles.map((p) => p.handle)).toContain(subjectHandle);
  });
});
