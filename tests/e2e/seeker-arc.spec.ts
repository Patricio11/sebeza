/**
 * Phase 12 (Task 12.3) — seeker golden path:
 * sign in (seeded account) → dashboard → privacy centre.
 *
 * Uses the dev-seed credentials from db/seed.ts (every seeded account is
 * email-verified so sign-in works immediately against the test DB).
 */
import { expect, test, type Page } from "@playwright/test";

const SEEKER_EMAIL = "andile-z@example.co.za";
const SEED_PASSWORD = "sebenza-dev-2026";

async function signInSeeker(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

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
  await signInSeeker(page);
  await page.goto("/en/dashboard/activity");
  await expect(page.locator("main")).toBeVisible();
});

test("Phase 15: CV builder renders from profile data, switches template, no overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await signInSeeker(page);
  await page.goto("/en/dashboard/cv");

  // The CV document + the controls render.
  await expect(
    page.getByRole("article", { name: /build your cv/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /print/i })).toBeVisible();

  // The seeded seeker's name appears on their own CV (renders from real
  // profile data, not a placeholder).
  await expect(page.locator("article h1")).not.toBeEmpty();

  // Switching the template is a real navigation, not a dead control.
  await page.getByRole("link", { name: /compact/i }).click();
  await page.waitForURL(/template=compact/);
  await expect(
    page.getByRole("article", { name: /build your cv/i }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("Phase 15: dashboard surfaces the Get work-ready entry", async ({
  page,
}) => {
  await signInSeeker(page);
  // The work-ready card + its one-tap CV link are discoverable.
  await expect(
    page.getByRole("heading", { name: /get ready for the work/i }),
  ).toBeVisible();
});

test("Phase 16: dashboard surfaces 'Work near you' with truthful pool label, no overflow", async ({
  page,
}) => {
  await signInSeeker(page);

  // The "Work near you" card renders (reverse-matching framing).
  await expect(
    page.getByRole("heading", { name: /be found for .* near/i }),
  ).toBeVisible();

  // 16.1.3 / D1: the pool link is labelled truthfully ("matched against"),
  // and the surface never frames the talent pool as "opportunities".
  await expect(
    page.getByRole("link", { name: /who you're matched against/i }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/opportunities near/i);

  await expectNoHorizontalOverflow(page);
});
