/**
 * Phase 12 (Task 12.2)  taxonomy suggestion lifecycle (9.15) + the
 * mark-as-filled vacancy-outcome loop (9.11), against the real database.
 *
 * Taxonomy contracts:
 *   - submit (seeker) → pending row + admin notification
 *   - reject NEVER mutates the submitting user's data (Verification-
 *     Honesty / D4  the row flips state, nothing else changes)
 *   - promote canonicalises into the controlled vocabulary
 *
 * Mark-as-filled contracts:
 *   - accepted invitees bypass the reveal gate (the invitation IS the
 *     two-way engagement); placements land + vacancy flips to filled
 *   - second attempt on a filled vacancy is refused (race protection)
 *   - accepted-but-not-hired invitees receive the anonymised
 *     vacancy.outcome.other-hired notification; merely-invited
 *     (never accepted) profiles do NOT (9.11 D5)
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

const ADMIN = { id: "user_sebenza-admin", role: "admin" as const, email: "admin@sebenzasa.com" };
const SEEKER = { id: "user_andile-z", role: "seeker" as const, email: "andile-z@example.co.za" };
const EMPLOYER = {
  id: "user_naledi-k",
  role: "employer" as const,
  email: "naledi.khumalo@discovery.co.za",
  orgId: "org_discovery-bank",
  orgVerified: true,
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => SEEKER),
    verifySession: vi.fn(async () => SEEKER),
    verifyAdmin: vi.fn(async () => ADMIN),
    verifyEmployer: vi.fn(async () => EMPLOYER),
    verifyOrgVerified: vi.fn(async () => EMPLOYER),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import {
  promoteTaxonomySuggestion,
  rejectTaxonomySuggestion,
  submitTaxonomySuggestion,
} from "@/lib/taxonomy/suggestions";
import { markVacancyFilledAndLogHires } from "@/lib/employer/vacancies";

const db = getDb();

describe("taxonomy suggestion lifecycle (9.15)", () => {
  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM taxonomy_suggestions WHERE custom_text LIKE 'Phase12%'`,
    );
    await db.execute(
      sql`DELETE FROM professions WHERE label LIKE 'Phase12%'`,
    );
  });

  test("submit → pending row; reject flips state and NOTHING about the user changes", async () => {
    const before = (await db.execute(
      sql`SELECT profession, secondary_professions::text AS sp FROM profiles WHERE user_id = ${SEEKER.id}`,
    )) as unknown as { rows: Array<{ profession: string; sp: string | null }> };

    const submitted = await submitTaxonomySuggestion({
      kind: "profession",
      customText: "Phase12 Drone Pilot",
    });
    expect(submitted.ok, JSON.stringify(submitted)).toBe(true);
    if (!submitted.ok) return;

    const rejected = await rejectTaxonomySuggestion({
      suggestionId: submitted.suggestionId,
      reason: "Phase 12 fixture rejection",
    });
    expect(rejected.ok, JSON.stringify(rejected)).toBe(true);

    const row = (await db.execute(
      sql`SELECT state FROM taxonomy_suggestions WHERE id = ${submitted.suggestionId}`,
    )) as unknown as { rows: Array<{ state: string }> };
    expect(row.rows[0]?.state).toBe("rejected");

    const after = (await db.execute(
      sql`SELECT profession, secondary_professions::text AS sp FROM profiles WHERE user_id = ${SEEKER.id}`,
    )) as unknown as { rows: Array<{ profession: string; sp: string | null }> };
    expect(after.rows[0], "user data must be untouched by rejection").toEqual(
      before.rows[0],
    );
  });

  test("promote canonicalises into the professions taxonomy", async () => {
    const submitted = await submitTaxonomySuggestion({
      kind: "profession",
      customText: "Phase12 Beekeeper",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const promoted = await promoteTaxonomySuggestion({
      suggestionId: submitted.suggestionId,
    });
    expect(promoted.ok, JSON.stringify(promoted)).toBe(true);

    const prof = (await db.execute(
      sql`SELECT slug FROM professions WHERE label = 'Phase12 Beekeeper'`,
    )) as unknown as { rows: Array<{ slug: string }> };
    expect(prof.rows, "promoted label must exist in the taxonomy").toHaveLength(1);

    const state = (await db.execute(
      sql`SELECT state FROM taxonomy_suggestions WHERE id = ${submitted.suggestionId}`,
    )) as unknown as { rows: Array<{ state: string }> };
    expect(state.rows[0]?.state).toBe("promoted");
  });
});

describe("mark-as-filled (9.11)", () => {
  const VACANCY = "vac_backend-developer"; // seeded open Discovery vacancy
  const HIRED = "prof_andile-z";
  const ACCEPTED_NOT_HIRED = "prof_thandeka-m";
  const INVITED_NEVER_ACCEPTED = "prof_lerato-n";

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM placements WHERE vacancy_id = ${VACANCY} AND profile_id = ${HIRED}`,
    );
    await db.execute(
      sql`DELETE FROM vacancy_invitations WHERE vacancy_id = ${VACANCY}
          AND profile_id IN (${HIRED}, ${ACCEPTED_NOT_HIRED}, ${INVITED_NEVER_ACCEPTED})`,
    );
    await db.execute(
      sql`UPDATE vacancies SET status = 'open', closed_at = NULL WHERE id = ${VACANCY}`,
    );
    await db.execute(
      sql`DELETE FROM notifications WHERE kind = 'vacancy.outcome.other-hired'
          AND meta->>'vacancyId' = ${VACANCY}`,
    );
  });

  test("fill with an accepted invitee: placement + filled flip + honest outcome fan-out", async () => {
    // Pipeline fixture: hired + accepted-not-hired + invited-never-accepted.
    for (const [profileId, state] of [
      [HIRED, "accepted"],
      [ACCEPTED_NOT_HIRED, "accepted"],
      [INVITED_NEVER_ACCEPTED, "invited"],
    ] as const) {
      await db.execute(
        sql`INSERT INTO vacancy_invitations (id, vacancy_id, profile_id, invited_by_user_id, state, expires_at)
            VALUES (${randomUUID()}, ${VACANCY}, ${profileId}, ${EMPLOYER.id}, ${state}::invitation_state, now() + interval '14 days')
            ON CONFLICT (vacancy_id, profile_id) DO UPDATE SET state = ${state}::invitation_state`,
      );
    }

    const res = await markVacancyFilledAndLogHires({
      vacancyId: VACANCY,
      hires: [{ profileId: HIRED }],
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);
    if (!res.ok) return;
    expect(res.placementIds).toHaveLength(1);

    const vacancy = (await db.execute(
      sql`SELECT status FROM vacancies WHERE id = ${VACANCY}`,
    )) as unknown as { rows: Array<{ status: string }> };
    expect(vacancy.rows[0]?.status).toBe("filled");

    const placement = (await db.execute(
      sql`SELECT source FROM placements WHERE id = ${res.placementIds[0]!}`,
    )) as unknown as { rows: Array<{ source: string }> };
    expect(placement.rows[0]?.source).toBe("employer_confirmed");

    // 9.11 D5: accepted-but-not-hired gets the anonymised outcome…
    const outcomes = (await db.execute(
      sql`SELECT n.user_id FROM notifications n
          WHERE n.kind = 'vacancy.outcome.other-hired'`,
    )) as unknown as { rows: Array<{ user_id: string }> };
    const recipients = outcomes.rows.map((r) => r.user_id);
    expect(recipients).toContain("user_thandeka-m");
    // …and the merely-invited (never accepted) profile does NOT.
    expect(recipients).not.toContain("user_lerato-n");
    // The hired person never receives their own "someone else was hired".
    expect(recipients).not.toContain("user_andile-z");
  });

  test("second attempt on a filled vacancy is refused (race protection)", async () => {
    const res = await markVacancyFilledAndLogHires({
      vacancyId: VACANCY,
      hires: [{ profileId: ACCEPTED_NOT_HIRED }],
    });
    expect(res.ok).toBe(false);
  });
});
