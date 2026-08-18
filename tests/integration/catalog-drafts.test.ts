/**
 * COMPASS_FUEL_PLAN B  the AI-drafted catalogue pipeline, against the
 * real database (LLM call itself is gated off; drafts inserted by hand).
 *
 * Contracts:
 *   - drafting refuses while the curriculum kill-switch is OFF (no
 *     provider call, no spend)
 *   - approve validates + copies the (possibly edited) payload into
 *     learning_paths with sebenzaReviewed=false, single-use
 *   - reject resolves the draft without touching learning_paths
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

const ADMIN = {
  id: "user_sebenza-admin",
  role: "admin" as const,
  email: "admin@sebenzasa.com",
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return { ...original, verifyAdmin: vi.fn(async () => ADMIN) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  requestCatalogDrafts,
  approveCatalogDraft,
  rejectCatalogDraft,
} from "@/lib/admin/catalog-drafts";

const db = getDb();
const draftIds: string[] = [];
const PAYLOAD = {
  title: "Blend Test SETA Learnership",
  provider: "Services SETA",
  providerKind: "seta" as const,
  cost: "free" as const,
  costNote: null,
  outcome: "NQF-aligned certificate plus workplace hours",
  durationWeeks: 26,
  unlocksSkills: ["Blend Test Skill"],
  national: true,
  url: null,
};

async function insertDraft(): Promise<string> {
  const id = `cd_${randomUUID()}`;
  draftIds.push(id);
  await db.insert(schema.catalogDrafts).values({
    id,
    skillSlugs: ["blend-test"],
    payload: PAYLOAD,
    state: "pending",
    rawModel: "test-model",
    createdByUserId: ADMIN.id,
  });
  return id;
}

afterAll(async () => {
  await db.delete(schema.catalogDrafts).where(inArray(schema.catalogDrafts.id, draftIds));
  await db
    .delete(schema.learningPaths)
    .where(eq(schema.learningPaths.title, PAYLOAD.title));
});

describe("catalogue draft pipeline", () => {
  test("drafting refuses while the LLM kill-switch is OFF", async () => {
    const res = await requestCatalogDrafts({ skillSlugs: ["anything"] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("switch is OFF");
  });

  test("approve copies the edited payload into learning_paths, single-use", async () => {
    const id = await insertDraft();
    const res = await approveCatalogDraft({
      id,
      payload: { ...PAYLOAD, url: "https://www.servicesseta.org.za" },
    });
    expect(res.ok).toBe(true);

    const [path] = await db
      .select()
      .from(schema.learningPaths)
      .where(eq(schema.learningPaths.title, PAYLOAD.title));
    expect(path).toBeTruthy();
    expect(path?.sebenzaReviewed).toBe(false);
    expect(path?.url).toBe("https://www.servicesseta.org.za");
    expect(path?.unlocksSkills).toEqual(PAYLOAD.unlocksSkills);

    const replay = await approveCatalogDraft({ id, payload: PAYLOAD });
    expect(replay.ok).toBe(false);
  });

  test("reject resolves without touching the catalog", async () => {
    const id = await insertDraft();
    const before = await db.select({ id: schema.learningPaths.id }).from(schema.learningPaths);
    const res = await rejectCatalogDraft({ id, note: "duplicate" });
    expect(res.ok).toBe(true);
    const after = await db.select({ id: schema.learningPaths.id }).from(schema.learningPaths);
    expect(after.length).toBe(before.length);
    const [row] = await db
      .select({ state: schema.catalogDrafts.state })
      .from(schema.catalogDrafts)
      .where(eq(schema.catalogDrafts.id, id));
    expect(row?.state).toBe("rejected");
  });
});
