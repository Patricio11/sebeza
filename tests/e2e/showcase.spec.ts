/**
 * Phase 23.7 — the showcase walkthrough. Proves the flagship seeded flows work
 * end-to-end on LIVE DB data (no fabricated content anywhere) and captures a
 * screenshot at each key step to `test-results/screenshots/<project>/` for
 * visual review. Accounts: docs/SHOWCASE_ACCOUNTS.md.
 *
 * Every assertion is against REAL seeded rows: landing stats from the DB, the
 * student lane's destinations from 11 confirmed placements, the not-hired
 * invitee's honest outcome notification, the employer's filled-vacancy story.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SEED_PASSWORD = "sebenza-dev-2026";

function shotPath(testInfo: TestInfo, name: string): string {
  return `test-results/screenshots/${testInfo.project.name}/${name}.png`;
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: shotPath(testInfo, name), fullPage: true });
}

async function signIn(page: Page, email: string, urlRe: RegExp) {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(urlRe, { timeout: 30_000 });
}

test("landing page renders live stats and no fabricated outcomes", async ({
  page,
}, testInfo) => {
  await page.goto("/en");
  await expect(page.getByText("Today on Sebenza")).toBeVisible();
  await expect(page.getByText("Active profiles").first()).toBeVisible();
  // The fabricated testimonials section is gone (Phase 23.2).
  await expect(page.getByText("Not screenshots.")).toHaveCount(0);
  await expect(page.getByText("Thandeka M.")).toHaveCount(0);
  await shoot(page, testInfo, "01-landing");
});

test("student flagship: dashboard + career compass + REAL student lane", async ({
  page,
}, testInfo) => {
  await signIn(page, "andile-z@example.co.za", /\/dashboard/);
  await expect(page.locator("main")).toBeVisible();
  await shoot(page, testInfo, "02-seeker-dashboard");

  await page.goto("/en/dashboard/grow");
  await expect(page.locator("main")).toBeVisible();
  await shoot(page, testInfo, "03-career-compass");

  // The student lane's destinations are REAL: 11 employer-confirmed cohort
  // placements (over the k-floor) — the table renders with a real role.
  await expect(
    page.getByRole("heading", { name: /Where BSc Computer Science graduates go/i }),
  ).toBeVisible();
  await expect(page.getByText("Software developer").first()).toBeVisible();
  // Live programme listings from the graduate_programmes table.
  await expect(
    page.getByText("MICT SETA Cloud Engineer Learnership"),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: /Where BSc Computer Science graduates go/i })
    .scrollIntoViewIfNeeded();
  await shoot(page, testInfo, "04-student-lane-destinations");
});

test("feedback story: the not-hired invitee sees the honest outcome notification", async ({
  page,
}, testInfo) => {
  await signIn(page, "wits-bsc-cs-2026-06@example.co.za", /\/dashboard/);
  await page.goto("/en/dashboard/notifications");
  await expect(
    page.getByText("Update on Graduate Software Developer Programme").first(),
  ).toBeVisible();
  await expect(
    page.getByText(/filled this role with another candidate/i).first(),
  ).toBeVisible();
  await shoot(page, testInfo, "05-outcome-feedback");
});

test("employer: vacancy lifecycle incl. the filled vacancy with linked hires", async ({
  page,
}, testInfo) => {
  await signIn(page, "naledi.khumalo@discovery.co.za", /\/employer/);
  await page.goto("/en/employer/vacancies");
  await expect(
    page.getByText("Graduate Software Developer Programme").first(),
  ).toBeVisible();
  await shoot(page, testInfo, "06-employer-vacancies");

  await page
    .getByRole("link", { name: /Graduate Software Developer Programme/ })
    .first()
    .click();
  await page.waitForURL(/\/employer\/vacancies\//, { timeout: 30_000 });
  // The hired cohort members' confirmed placements are linked to this vacancy.
  await expect(page.getByText(/BSc CS Cohort 0[123]/).first()).toBeVisible();
  await shoot(page, testInfo, "07-filled-vacancy");
});

test("admin: feature-flag console renders (ship-dark switches)", async ({
  page,
}, testInfo) => {
  await signIn(page, "admin@sebenzasa.com", /\/admin/);
  await page.goto("/en/admin/settings");
  await expect(page.getByText(/feature flag/i).first()).toBeVisible();
  await shoot(page, testInfo, "08-admin-settings");
});
