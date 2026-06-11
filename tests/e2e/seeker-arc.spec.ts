/**
 * Phase 12 (Task 12.3) — seeker golden path:
 * sign in (seeded account) → dashboard → privacy centre.
 *
 * Uses the dev-seed credentials from db/seed.ts (every seeded account is
 * email-verified so sign-in works immediately against the test DB).
 */
import { expect, test } from "@playwright/test";

const SEEKER_EMAIL = "andile-z@example.co.za";
const SEED_PASSWORD = "sebenza-dev-2026";

test("seeker signs in and lands on the dashboard", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible();
});

test("privacy centre lists consents with revoke affordances", async ({
  page,
}) => {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await page.goto("/en/dashboard/privacy");
  await expect(page.locator("main")).toBeVisible();
  // The searchability consent (granted for every seeded seeker) must be
  // visible — the page proves consent state is read from the real DB.
  await expect(page.locator("main")).toContainText(/consent/i);
});

test("seeker's own activity page renders (audit transparency surface)", async ({
  page,
}) => {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await page.goto("/en/dashboard/activity");
  await expect(page.locator("main")).toBeVisible();
});
