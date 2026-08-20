/**
 * 2026-08-20  sign-out had ZERO E2E coverage, and a founder hit the
 * "Something went wrong" boundary signing out of /dashboard/profile on
 * production. This walks the real flow for every role and asserts the
 * error boundary never appears.
 */
import { test, expect, type Page } from "@playwright/test";

const SEED_PASSWORD = "sebenza-dev-2026";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|employer|admin)/, { timeout: 30_000 });
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

async function expectNoErrorBoundary(page: Page): Promise<void> {
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  await expect(page.getByText(/we've logged it/i)).toHaveCount(0);
}

test("seeker signs out from the profile editor", async ({ page }) => {
  await signIn(page, "andile-z@example.co.za");

  // The exact surface from the report, anchor included.
  await page.goto("/en/dashboard/profile#avatar");
  await expect(page.locator("main")).toBeVisible();

  await page
    .getByRole("button", { name: /^sign out$/i })
    .first()
    .click();

  // Lands somewhere public, session gone, and NO error boundary.
  await page.waitForURL(/\/(en)?$|\/sign-in/, { timeout: 30_000 });
  await expectNoErrorBoundary(page);

  // The session really is gone: a protected route bounces to sign-in.
  await page.goto("/en/dashboard/profile");
  await page.waitForURL(/\/sign-in/, { timeout: 30_000 });
  await expectNoErrorBoundary(page);
});

test("employer and admin sign out cleanly too", async ({ page }) => {
  for (const email of ["naledi.khumalo@discovery.co.za", "admin@sebenzasa.com"]) {
    await signIn(page, email);
    await page
      .getByRole("button", { name: /^sign out$/i })
      .first()
      .click();
    await page.waitForURL(/\/(en)?$|\/sign-in/, { timeout: 30_000 });
    await expectNoErrorBoundary(page);
  }
});
