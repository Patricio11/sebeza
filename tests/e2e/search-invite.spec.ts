/**
 * Phase 29  the seamless /search invite funnel, end to end:
 *
 *   logged-out visitor selects candidates on the PUBLIC search
 *     → floating bar → "Invite" → sign-in gate (selection saved locally)
 *     → signs in as the verified showcase employer
 *     → lands back on /search?invite=1, dialog re-opens with the selection
 *     → takes the create-a-vacancy detour (returnTo round-trip)
 *     → sets "Open positions: 2" on the new vacancy (Phase 29.1)
 *     → back in the dialog, picks the new vacancy → sends 2 invitations
 *     → honest success counts; selection cleared
 *   + the match page shows the seat context for the new vacancy
 *   + seekers see no selection UI at all (hide-not-disable)
 *
 * Self-resetting: the funnel vacancy (and its invitations) are deleted
 * at start + end so desktop/mobile runs and re-runs stay independent.
 * Candidates: andile-z + lerato-n  the two seeded seekers holding
 * `vacancy_matching` consent, so exactly 2 invites send (0 skipped).
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const EMPLOYER_EMAIL = "naledi.khumalo@discovery.co.za";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FUNNEL_VACANCY_TITLE = "E2E Funnel Growth Role";

let sql: ReturnType<typeof postgres> | null = null;

async function cleanupFunnelVacancy() {
  if (!sql) return;
  await sql`
    DELETE FROM vacancy_invitations
    WHERE vacancy_id IN (SELECT id FROM vacancies WHERE title = ${FUNNEL_VACANCY_TITLE})
  `;
  await sql`DELETE FROM vacancies WHERE title = ${FUNNEL_VACANCY_TITLE}`;
}

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing  see playwright.config.");
  sql = postgres(url, { max: 1 });
  await cleanupFunnelVacancy();

  // Self-sufficient consent posture: the funnel asserts "2 sent, 0
  // skipped", which requires the SEEDED vacancy_matching grants for
  // both candidates. An integration suite historically wiped one
  // (reveal-placement-gates  now fixed to restore), so we pin the
  // posture here instead of trusting suite order. Granted IS the seed
  // state for these two, so no afterAll reversal is needed.
  for (const handle of ["andile-z", "lerato-n"]) {
    const userId = `user_${handle}`;
    await sql`
      DELETE FROM consents
      WHERE user_id = ${userId} AND purpose = 'vacancy_matching'
    `;
    await sql`
      INSERT INTO consents (id, user_id, purpose, state, version, granted_at)
      VALUES (${`cns_e2e_funnel_${handle}`}, ${userId}, 'vacancy_matching', 'granted', 'v2.1', now())
    `;
  }
});

test.afterAll(async () => {
  if (!sql) return;
  await cleanupFunnelVacancy();
  await sql.end();
  sql = null;
});

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.project.name}/${name}.png`,
    fullPage: false,
  });
}

async function dismissCookieBanner(page: Page) {
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

test("public multi-select → sign-in → create-vacancy detour → bulk invite", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);

  // ── 1. Logged-out selection on the public search ─────────────────────
  await page.goto("/en/search");
  await dismissCookieBanner(page);
  const main = page.getByRole("main");

  await main
    .getByRole("checkbox", { name: "Select Andile Z. to invite" })
    .check();
  await main
    .getByRole("checkbox", { name: "Select Lerato N. to invite" })
    .check();

  const bar = page.getByRole("status").filter({ hasText: "selected" });
  await expect(bar).toContainText("2 candidates selected");
  await shoot(page, testInfo, "funnel-1-selection-bar");

  // The selection lives in localStorage  a reload must not lose it.
  await page.reload();
  await expect(bar).toContainText("2 candidates selected");

  // ── 2. The sign-in gate ───────────────────────────────────────────────
  await bar.getByRole("button", { name: "Invite" }).click();
  const dialog = page.getByRole("dialog", { name: /candidates selected/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Andile Z.");
  await shoot(page, testInfo, "funnel-2-signin-gate");
  await dialog.getByRole("link", { name: /sign in to invite/i }).click();

  await page.waitForURL(/\/sign-in/);
  await page.locator("#email").fill(EMPLOYER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // ── 3. Back on search: selection restored, dialog re-opened ──────────
  await page.waitForURL(/\/search.*invite=1/, { timeout: 30_000 });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toContainText("2 candidates selected");
  await shoot(page, testInfo, "funnel-3-picker-after-signin");

  // ── 4. Create-a-vacancy detour (returnTo round-trip) ─────────────────
  await dialog
    .getByRole("link", { name: /create a new vacancy/i })
    .click();
  await page.waitForURL(/\/employer\/vacancies\/new\?.*returnTo=/, {
    timeout: 30_000,
  });
  await dismissCookieBanner(page);

  await page.getByLabel(/role title/i).fill(FUNNEL_VACANCY_TITLE);
  // Profession combobox: a button that opens a picker dialog with a
  // search textbox + listbox (bottom-sheet on mobile).
  await page.getByRole("button", { name: "Profession" }).click();
  const professionPicker = page.getByRole("dialog", {
    name: "Profession picker",
  });
  await professionPicker.getByRole("combobox").fill("Software Developer");
  await professionPicker
    .getByRole("option", { name: /^Software Developer$/ })
    .first()
    .click();
  // Province is a CustomSelect (button + listbox), not a native <select>.
  await page.getByRole("button", { name: "Province" }).click();
  await page.getByRole("option", { name: "Gauteng", exact: true }).click();
  // Phase 29.1  the new headcount field.
  await page.getByLabel(/open positions/i).fill("2");
  await shoot(page, testInfo, "funnel-4-vacancy-form");
  await page.getByRole("button", { name: /^Create vacancy$/ }).click();

  // ── 5. Back again with the selection; pick the new vacancy; send ─────
  await page.waitForURL(/\/search.*invite=1/, { timeout: 30_000 });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  // The radio's accessible name includes the location subtitle → regex.
  await dialog
    .getByRole("radio", { name: new RegExp(FUNNEL_VACANCY_TITLE) })
    .check();
  await dialog
    .getByRole("button", { name: /send 2 invitations/i })
    .click();

  // Both candidates hold vacancy_matching consent → 2 sent, 0 skipped.
  await expect(dialog).toContainText(
    `2 invitations sent for ${FUNNEL_VACANCY_TITLE}`,
    { timeout: 30_000 },
  );
  await shoot(page, testInfo, "funnel-5-sent");
  await dialog.getByRole("button", { name: "Done" }).click();

  // Funnel complete → the selection (and bar) are gone.
  await expect(bar).toBeHidden();

  // ── 6. Seat context on the match page (Phase 29.1) ───────────────────
  const rows = await sql!<{ id: string }[]>`
    SELECT id FROM vacancies WHERE title = ${FUNNEL_VACANCY_TITLE} LIMIT 1
  `;
  const vacancyId = rows[0]?.id;
  expect(vacancyId).toBeTruthy();
  await page.goto(`/en/employer/vacancies/${vacancyId}/match`);
  await expect(page.getByText("2 positions to fill")).toBeVisible({
    timeout: 15_000,
  });
  await shoot(page, testInfo, "funnel-6-seat-context");
});

test("seekers see no selection UI on /search (hide-not-disable)", async ({
  page,
}) => {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await page.goto("/en/search");
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("main").getByRole("link", { name: /view profile/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /to invite$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "selected" }),
  ).toHaveCount(0);
});
