/**
 * Profession pipe split (docs/PROFESSION_PIPE_SPLIT_PLAN.md), against the
 * real database:
 *
 *   - the profile editor stores "A | B" as headline A + secondary B and
 *     raises one pending suggestion per custom part
 *   - promoting B (with a corrected label) rewrites it inside the
 *     seeker's secondary array
 *   - the admin Split action fixes a profile still carrying the joined
 *     text, creates per-part rows and resolves the joined row
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

const ADMIN = { id: "user_sebenza-admin", role: "admin" as const, email: "admin@sebenzasa.com" };
const SEEKER = { id: "user_andile-z", role: "seeker" as const, email: "andile-z@example.co.za" };

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => SEEKER),
    verifySession: vi.fn(async () => SEEKER),
    verifyAdmin: vi.fn(async () => ADMIN),
  };
});
vi.mock("@/lib/auth/guard", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/guard")>();
  return { ...original, getSessionUser: vi.fn(async () => SEEKER) };
});
vi.mock("next/cache", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/cache")>();
  return { ...original, revalidatePath: vi.fn(), revalidateTag: vi.fn() };
});

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { updateProfileBasics } from "@/lib/profile/actions";
import {
  promoteTaxonomySuggestion,
  splitTaxonomySuggestion,
} from "@/lib/taxonomy/suggestions";

const PRIMARY = "Zeta Automation Specialist";
const SECOND = "Omega Chain Architect";
const SECOND_FIXED = "Omega Supply Chain Architect";
const JOINED_A = "Alpha Pipe One";
const JOINED_B = "Beta Pipe Two";
const TEST_TEXTS = [PRIMARY, SECOND, SECOND_FIXED, JOINED_A, JOINED_B, `${JOINED_A} | ${JOINED_B}`];

type ProfileRow = {
  id: string;
  display_name: string;
  profession: string;
  secondary_professions: string[];
  city: string;
  province: string;
};

async function profile(): Promise<ProfileRow> {
  const db = getDb();
  const r = await db.execute(sql`
    SELECT id, display_name, profession, secondary_professions, city, province
    FROM profiles WHERE user_id = ${SEEKER.id} AND deleted_at IS NULL LIMIT 1
  `);
  const row = (r as unknown as { rows?: ProfileRow[] }).rows?.[0] ?? (r as unknown as ProfileRow[])[0];
  if (!row) throw new Error("seeded seeker profile missing");
  return row;
}

async function pendingFor(text: string): Promise<number> {
  const db = getDb();
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM taxonomy_suggestions
    WHERE submitted_by_user_id = ${SEEKER.id} AND kind = 'profession' AND state = 'pending'
      AND lower(custom_text) = lower(${text})
  `);
  const row = (r as unknown as { rows?: { n: number }[] }).rows?.[0] ?? (r as unknown as { n: number }[])[0];
  return row?.n ?? 0;
}

let original: ProfileRow;

beforeAll(async () => {
  original = await profile();
});

afterAll(async () => {
  const db = getDb();
  // Typed builder on purpose: a JS array interpolated into raw sql
  // binds as a parameter list, which is the very trap this feature
  // guards against elsewhere.
  await db
    .update(schema.profiles)
    .set({
      profession: original.profession,
      secondaryProfessions: original.secondary_professions ?? [],
    })
    .where(eq(schema.profiles.id, original.id));
  for (const t of TEST_TEXTS) {
    await db.execute(sql`DELETE FROM taxonomy_suggestions WHERE lower(custom_text) = lower(${t})`);
    await db.execute(sql`DELETE FROM professions WHERE lower(label) = lower(${t})`);
  }
});

describe("profession pipe split", () => {
  test("editor save: 'A | B' lands as headline A + secondary B, one suggestion each", async () => {
    const res = await updateProfileBasics({
      displayName: original.display_name,
      profession: `${PRIMARY} | ${SECOND}`,
      secondaryProfessions: [],
      seniority: null,
      city: original.city,
      province: original.province,
      nationality: "ZA",
      bio: null,
      yearsExperience: null,
    });
    expect(res.ok, res.ok ? "" : res.message).toBe(true);
    if (res.ok) {
      expect(res.profession).toBe(PRIMARY);
      expect(res.secondaryProfessions).toEqual([SECOND]);
    }
    const p = await profile();
    expect(p.profession).toBe(PRIMARY);
    expect(p.secondary_professions).toEqual([SECOND]);
    expect(await pendingFor(PRIMARY)).toBe(1);
    expect(await pendingFor(SECOND)).toBe(1);
    expect(await pendingFor(`${PRIMARY} | ${SECOND}`)).toBe(0);
  });

  test("promoting the secondary with a corrected label rewrites the secondary array", async () => {
    const db = getDb();
    const r = await db.execute(sql`
      SELECT id FROM taxonomy_suggestions
      WHERE submitted_by_user_id = ${SEEKER.id} AND state = 'pending' AND lower(custom_text) = lower(${SECOND})
      LIMIT 1
    `);
    const id = ((r as unknown as { rows?: { id: string }[] }).rows?.[0] ?? (r as unknown as { id: string }[])[0])?.id;
    expect(id).toBeTruthy();
    const res = await promoteTaxonomySuggestion({ suggestionId: id!, correctedLabel: SECOND_FIXED });
    expect(res.ok, res.ok ? "" : res.message).toBe(true);
    if (res.ok) expect(res.backfilledRows).toBeGreaterThanOrEqual(1);
    const p = await profile();
    expect(p.profession).toBe(PRIMARY);
    expect(p.secondary_professions).toEqual([SECOND_FIXED]);
  });

  test("admin Split: joined headline fixed, per-part rows created, joined row resolved", async () => {
    const db = getDb();
    const joined = `${JOINED_A} | ${JOINED_B}`;
    await db.execute(sql`
      UPDATE profiles SET profession = ${joined}, secondary_professions = '{}'::text[] WHERE id = ${original.id}
    `);
    const joinedId = `tx_${randomUUID()}`;
    await db.execute(sql`
      INSERT INTO taxonomy_suggestions (id, kind, custom_text, submitted_by_user_id)
      VALUES (${joinedId}, 'profession', ${joined}, ${SEEKER.id})
    `);

    const res = await splitTaxonomySuggestion({ suggestionId: joinedId });
    expect(res.ok, res.ok ? "" : res.message).toBe(true);
    if (res.ok) {
      expect(res.parts).toEqual([JOINED_A, JOINED_B]);
      expect(res.profilesUpdated).toBe(1);
      expect(res.rowsCreated).toBe(2);
    }
    const p = await profile();
    expect(p.profession).toBe(JOINED_A);
    expect(p.secondary_professions).toEqual([JOINED_B]);
    expect(await pendingFor(JOINED_A)).toBe(1);
    expect(await pendingFor(JOINED_B)).toBe(1);
    expect(await pendingFor(joined)).toBe(0);
    const state = await db.execute(sql`SELECT state, admin_note FROM taxonomy_suggestions WHERE id = ${joinedId}`);
    const row = ((state as unknown as { rows?: { state: string; admin_note: string }[] }).rows?.[0]
      ?? (state as unknown as { state: string; admin_note: string }[])[0]);
    expect(row?.state).toBe("merged");
    expect(row?.admin_note).toContain(JOINED_B);
  });

  test("a plain text with no separator is refused by Split", async () => {
    const db = getDb();
    const id = `tx_${randomUUID()}`;
    await db.execute(sql`
      INSERT INTO taxonomy_suggestions (id, kind, custom_text, submitted_by_user_id)
      VALUES (${id}, 'profession', ${JOINED_A}, ${SEEKER.id})
    `);
    const res = await splitTaxonomySuggestion({ suggestionId: id });
    expect(res.ok).toBe(false);
    await db.execute(sql`DELETE FROM taxonomy_suggestions WHERE id = ${id}`);
  });
});
