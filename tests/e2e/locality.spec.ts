/**
 * Phase 16 follow-up  browser coverage for the three surfaces that were
 * typecheck/build-clean but lacked an E2E assertion (per the Phase 16
 * self-audit):
 *
 *   - 15.3.1  the "Prepare for this role" card on an accepted invitation
 *   - 16.2.2  the "Same city" chip on the invitations list
 *   - 16.2.1  the "Same city" chip on the vacancy match page
 *
 * One controlled setup serves all three. The seeded "Senior Software
 * Engineer" vacancy (open, Gauteng, no city, requires typescript+postgres)
 * is temporarily given:
 *   - city `johannesburg`  matches its accepted invitee (wits-bsc-cs-
 *     2026-04, in Johannesburg) AND a matched candidate in that city, and
 *   - empty skill list + no seniority filter  so the match is
 *     profession-only and actually returns a Johannesburg candidate. (The
 *     real vacancy ANDs typescript+postgres via `websearch_to_tsquery` and
 *     requires `senior`, which matches almost nobody in the seed.)
 * All three are captured and restored in afterAll, so the seed is untouched
 * for other suites. The pages are `revalidate = 0`, so the DB change (same
 * instance the webServer reads) is visible on the next request.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const VACANCY_ID = "vac_senior-software-engineer";
const SEEKER_HANDLE = "wits-bsc-cs-2026-04"; // accepted invite, Johannesburg
const SEEKER_EMAIL = "wits-bsc-cs-2026-04@example.co.za";
const EMPLOYER_EMAIL = "naledi.khumalo@discovery.co.za"; // Discovery Bank (verified)

let sql: ReturnType<typeof postgres> | null = null;
let invitationId: string | null = null;
let originalCity: string | null = null;
let originalSkills: string[] = [];
let originalSeniority: string | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing  playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });

  const [vac] = await sql<
    { city_slug: string | null; skill_slugs: string[]; seniority: string | null }[]
  >`
    SELECT city_slug, skill_slugs, seniority FROM vacancies WHERE id = ${VACANCY_ID}
  `;
  originalCity = vac?.city_slug ?? null;
  originalSkills = vac?.skill_slugs ?? [];
  originalSeniority = vac?.seniority ?? null;

  await sql`
    UPDATE vacancies
    SET city_slug = 'johannesburg', skill_slugs = '{}'::text[], seniority = NULL
    WHERE id = ${VACANCY_ID}
  `;

  const [inv] = await sql<{ id: string }[]>`
    SELECT vi.id
    FROM vacancy_invitations vi
    JOIN profiles p ON p.id = vi.profile_id
    WHERE vi.vacancy_id = ${VACANCY_ID} AND p.handle = ${SEEKER_HANDLE}
    LIMIT 1
  `;
  invitationId = inv?.id ?? null;
});

test.afterAll(async () => {
  if (sql) {
    await sql`
      UPDATE vacancies
      SET city_slug = ${originalCity},
          skill_slugs = ${sql.array(originalSkills)},
          seniority = ${originalSeniority}
      WHERE id = ${VACANCY_ID}
    `;
    await sql.end();
  }
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/sign-in"), {
    timeout: 30_000,
  });
}

test("15.3.1: invitation detail shows 'Prepare for this role' on an accepted invite", async ({
  page,
}) => {
  expect(invitationId, "seeded accepted invitation should exist").toBeTruthy();
  await signIn(page, SEEKER_EMAIL);
  // Direct nav (no flaky list-click) to the accepted invitation.
  await page.goto(`/en/dashboard/invitations/${invitationId}`);

  await expect(
    page.getByRole("heading", { name: /prepare for this role/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /interview/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /build your cv/i }).first(),
  ).toBeVisible();
});

test("16.2.2: invitations list shows 'Same city' when the role is in the seeker's city", async ({
  page,
}) => {
  await signIn(page, SEEKER_EMAIL);
  await page.goto("/en/dashboard/invitations");
  await expect(page.getByText("Same city").first()).toBeVisible();
});

test("16.2.1: vacancy match page shows 'Same city' for local candidates", async ({
  page,
}) => {
  await signIn(page, EMPLOYER_EMAIL);
  await page.goto(`/en/employer/vacancies/${VACANCY_ID}/match`);
  await expect(page.locator("main")).toBeVisible();
  // Candidates in the vacancy's city (Johannesburg) carry the chip.
  await expect(page.getByText("Same city").first()).toBeVisible();
});
