/**
 * Phase 12 (Task 12.2)  the three-lock reveal gate, the Placement-Truth
 * 30-day window, and the vacancy-invite consent gate, against the real
 * seeded database.
 *
 * Per D6 (docs/PHASE_12_PLAN.md): the DAL is the real security boundary,
 * so it is stubbed here with a verified-employer session (Discovery Bank's
 * owner) and the behaviour BENEATH it  consent checks, audit rows,
 * notifications, the reveal-window lookup  runs for real. Lock #1
 * (verified org) is pinned by asserting the action consults the DAL before
 * any data access.
 *
 * Mutations are scoped to two seeded seekers and cleaned up in afterAll;
 * the compliance project re-seeds independently, so nothing leaks.
 */
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

// ── Seam mocks (hoisted by vitest above the imports below) ──────────────
const SESSION = {
  id: "user_naledi-k", // Discovery Bank owner (seed fixture)
  role: "employer" as const,
  email: "naledi.khumalo@discovery.co.za",
  orgId: "org_discovery-bank",
  orgVerified: true,
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => SESSION),
    verifySession: vi.fn(async () => SESSION),
    verifyEmployer: vi.fn(async () => SESSION),
    verifyOrgVerified: vi.fn(async () => SESSION),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { revealContact } from "@/lib/employer/reveal";
import { markAsHired } from "@/lib/employer/placements";
import { bulkInviteToVacancy } from "@/lib/employer/invitations";
import { verifyOrgVerified } from "@/lib/auth/dal";

const db = getDb();

// Seed fixtures (db/seed.ts id convention: `${prefix}_${slug}`).
const SEEKER_A = {
  handle: "andile-z",
  userId: "user_andile-z",
  profileId: "prof_andile-z",
  email: "andile-z@example.co.za",
};
const SEEKER_B = {
  handle: "lerato-n",
  userId: "user_lerato-n",
  profileId: "prof_lerato-n",
};
const VACANCY_ID = "vac_senior-software-engineer"; // open, Discovery Bank

async function setConsent(
  userId: string,
  purpose: "contact_reveal" | "vacancy_matching",
  state: "granted" | "revoked" | "delete",
): Promise<void> {
  await db
    .delete(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, userId),
        eq(schema.consents.purpose, purpose),
      ),
    );
  if (state === "delete") return;
  await db.insert(schema.consents).values({
    id: randomUUID(),
    userId,
    purpose,
    state,
    version: "phase12-test-v1",
    grantedAt: state === "granted" ? new Date() : null,
    revokedAt: state === "revoked" ? new Date() : null,
  });
}

afterAll(async () => {
  // Remove rows this suite created so reruns stay deterministic.
  await db.execute(
    sql`DELETE FROM placements WHERE role IN ('Phase12 Test Role', 'Phase12 Gate Role')`,
  );
  await db.execute(
    sql`DELETE FROM vacancy_invitations WHERE vacancy_id = ${VACANCY_ID}
        AND profile_id IN (${SEEKER_A.profileId}, ${SEEKER_B.profileId})`,
  );
  await db.execute(
    sql`DELETE FROM audit_log WHERE meta->>'phase12Test' = 'true'`,
  );
  // Phase 29 fix  RESTORE the seeded consent posture this suite
  // mutates via setConsent (it deletes/rewrites contact_reveal +
  // vacancy_matching for both fixture seekers). Without this, every
  // integration run silently stripped lerato-n's seeded
  // `vacancy_matching` grant, which downstream E2E (the /search
  // invite funnel) depends on. Seed posture: vacancy_matching =
  // granted for both; contact_reveal = 'none' row.
  for (const seeker of [SEEKER_A, SEEKER_B]) {
    await setConsent(seeker.userId, "vacancy_matching", "granted");
    await setConsent(seeker.userId, "contact_reveal", "delete");
    await db.insert(schema.consents).values({
      id: randomUUID(),
      userId: seeker.userId,
      purpose: "contact_reveal",
      state: "none",
      version: "v2.1",
    });
  }
});

describe("revealContact  the three-lock gate", () => {
  test("lock #1: the DAL is consulted before anything else; its refusal aborts the action", async () => {
    const mock = vi.mocked(verifyOrgVerified);
    mock.mockRejectedValueOnce(new Error("REDIRECT:not-verified"));
    await expect(revealContact({ handle: SEEKER_A.handle })).rejects.toThrow(
      "REDIRECT:not-verified",
    );
  });

  test("lock #2: revoked consent → refused, no contact in the payload", async () => {
    await setConsent(SEEKER_A.userId, "contact_reveal", "revoked");
    const res = await revealContact({ handle: SEEKER_A.handle });
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain(SEEKER_A.email);
  });

  test("lock #2: missing consent row behaves exactly like revoked", async () => {
    await setConsent(SEEKER_A.userId, "contact_reveal", "delete");
    const res = await revealContact({ handle: SEEKER_A.handle });
    expect(res.ok).toBe(false);
  });

  test("all locks open: contact returned AND lock #3 audit row written AND seeker notified", async () => {
    await setConsent(SEEKER_A.userId, "contact_reveal", "granted");
    const res = await revealContact({ handle: SEEKER_A.handle });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    if (!res.ok) return;
    expect(res.contact.email).toBe(SEEKER_A.email);

    const audits = await db
      .select({ id: schema.auditLog.id, meta: schema.auditLog.meta })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.kind, "profile.contact.reveal"),
          eq(schema.auditLog.subject, SEEKER_A.profileId),
        ),
      );
    expect(audits.length, "reveal must write its audit row").toBeGreaterThan(0);
    expect(
      (audits[audits.length - 1]!.meta as { orgId?: string }).orgId,
    ).toBe(SESSION.orgId);

    const notifications = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, SEEKER_A.userId),
          eq(schema.notifications.kind, "contact.revealed"),
        ),
      );
    expect(notifications.length, "seeker must be notified").toBeGreaterThan(0);
  });
});

describe("markAsHired  Placement-Truth 30-day reveal window", () => {
  test("no prior reveal from this org → refused", async () => {
    const res = await markAsHired({
      handle: SEEKER_B.handle,
      role: "Phase12 Gate Role",
      city: "Johannesburg",
    });
    expect(res.ok).toBe(false);
  });

  test("a reveal OLDER than 30 days does not satisfy the gate", async () => {
    await db.insert(schema.auditLog).values({
      id: randomUUID(),
      kind: "profile.contact.reveal",
      actor: SESSION.id,
      subject: SEEKER_B.profileId,
      at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      meta: { orgId: SESSION.orgId, phase12Test: "true" },
    });
    const res = await markAsHired({
      handle: SEEKER_B.handle,
      role: "Phase12 Gate Role",
      city: "Johannesburg",
    });
    expect(res.ok, "31-day-old reveal must NOT open the gate").toBe(false);
  });

  test("a recent reveal opens the gate; placement lands as employer_confirmed + audited", async () => {
    // SEEKER_A received a real reveal in the suite above (recent).
    const res = await markAsHired({
      handle: SEEKER_A.handle,
      role: "Phase12 Test Role",
      city: "Cape Town",
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    if (!res.ok) return;

    const placements = await db
      .select({
        source: schema.placements.source,
        orgId: schema.placements.organizationId,
      })
      .from(schema.placements)
      .where(eq(schema.placements.id, res.placementId));
    expect(placements[0]?.source).toBe("employer_confirmed");
    expect(placements[0]?.orgId).toBe(SESSION.orgId);

    const notif = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, SEEKER_A.userId),
          eq(schema.notifications.kind, "placement.confirmed"),
        ),
      );
    expect(notif.length).toBeGreaterThan(0);
  });
});

describe("bulkInviteToVacancy  consent gate (9.8.4 D5)", () => {
  beforeAll(async () => {
    await setConsent(SEEKER_A.userId, "vacancy_matching", "granted");
    await setConsent(SEEKER_B.userId, "vacancy_matching", "delete");
  });

  test("consented seeker invited; non-consented silently skipped; reason never in the response", async () => {
    const res = await bulkInviteToVacancy({
      vacancyId: VACANCY_ID,
      profileIds: [SEEKER_A.profileId, SEEKER_B.profileId],
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    if (!res.ok) return;
    expect(res.invited).toBe(1);
    expect(res.skipped).toBe(1);
    // D5: the response payload must not leak WHY someone was skipped
    // (that would reveal consent state to the employer).
    expect(JSON.stringify(res).toLowerCase()).not.toContain("consent");

    const rows = await db
      .select({ profileId: schema.vacancyInvitations.profileId })
      .from(schema.vacancyInvitations)
      .where(eq(schema.vacancyInvitations.vacancyId, VACANCY_ID));
    const invitedIds = rows.map((r) => r.profileId);
    expect(invitedIds).toContain(SEEKER_A.profileId);
    expect(invitedIds).not.toContain(SEEKER_B.profileId);
  });

  test("re-inviting the same seeker dedupes instead of double-writing", async () => {
    const res = await bulkInviteToVacancy({
      vacancyId: VACANCY_ID,
      profileIds: [SEEKER_A.profileId],
    });
    expect(res.ok).toBe(true);
    const rows = await db
      .select({ id: schema.vacancyInvitations.id })
      .from(schema.vacancyInvitations)
      .where(
        and(
          eq(schema.vacancyInvitations.vacancyId, VACANCY_ID),
          eq(schema.vacancyInvitations.profileId, SEEKER_A.profileId),
        ),
      );
    expect(rows).toHaveLength(1);
  });
});
