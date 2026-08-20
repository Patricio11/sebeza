/**
 * Phase 35  screenshots of the new push surfaces, for review.
 *
 * Runs against the SEEDED test harness with the push integration
 * configured and `feature_flag_web_push` on, so the opt-in card and the
 * Phone column actually render rather than hiding themselves.
 *
 * Run on demand:
 *   npx playwright test tests/e2e/push-shots.spec.ts --project=desktop
 */
import { test, type Page } from "@playwright/test";

// Chromium denies notifications by default, which renders the card's
// "your browser is blocking these" state. Granting shows the state a
// real first-time visitor sees: the invitation to turn them on.
test.use({ permissions: ["notifications"] });

const OUT = "docs/screenshots/phase35";
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

test("seeker: opt-in card and the Phone column", async ({ page, context }) => {
  // Grant on the ORIGIN. The file-level `test.use` covers the context,
  // but headless Chromium still reports "denied" for the page unless the
  // permission is granted against the served origin explicitly.
  await context.grantPermissions(["notifications"], {
    origin: "http://localhost:3100",
  });
  await signIn(page, "andile-z@example.co.za");
  await page.goto("/en/dashboard/account");
  // The card resolves its state through a server action, so wait for it.
  await page.getByText(/get told on your phone/i).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);

  // eslint-disable-next-line no-console
  console.log(
    "Notification.permission =",
    await page.evaluate(() => Notification.permission),
  );
  const card = page.getByRole("region", { name: /get told on your phone/i }).first();
  await card.screenshot({ path: `${OUT}/seeker-optin-card.png` });

  // The first three rows are the invitation family, which is what the
  // Phone column exists for.
  // Anchored on the LABEL, not the catalog key: the key is deliberately
  // no longer rendered (it is a database identifier, not user copy).
  const prefs = page
    .locator("ul", { hasText: "flagged you for a specific role" })
    .first();
  await prefs.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await prefs.screenshot({ path: `${OUT}/seeker-prefs-rows.png` });
});

test("admin: the Push channel card", async ({ page }) => {
  await signIn(page, "admin@sebenzasa.com");
  await page.goto("/en/admin/integrations");
  const card = page
    .locator("div")
    .filter({ hasText: /^Push \(phone notifications\)/ })
    .first();
  await card.waitFor({ timeout: 20_000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await card.screenshot({ path: `${OUT}/admin-push-card.png` });

  // And the configure form open, which is what the founder will fill in.
  await card.getByRole("button", { name: /configure/i }).click().catch(() => {});
  await page.waitForTimeout(600);
  await card.screenshot({ path: `${OUT}/admin-push-form.png` });
});

test("sign-up: the preference beside the consents", async ({ page }) => {
  await page.goto("/en/sign-up/seeker");
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});

  // Step 1, minimum viable fill, then on to the consent step.
  await page.locator("#fullName").fill("Test Person");
  await page.locator("#email").fill("shot-only@example.co.za");
  await page.locator("#password").fill("sebenza-dev-2026");
  await page.locator("#dateOfBirth-day").fill("14").catch(() => {});
  await page.getByRole("button", { name: /continue/i }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/signup-step.png`, fullPage: true });
});
