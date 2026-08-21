/**
 * Screenshots of the hiring-loop work (docs/HIRING_LOOP_GAPS.md), for
 * review. Runs against the SEEDED harness, so every name on screen is a
 * fictional showcase profile.
 *
 *   npx playwright test tests/e2e/hiring-loop-shots.spec.ts --project=desktop
 */
import { test, type Page } from "@playwright/test";

const OUT = "docs/screenshots/hiring-loop";
const SEED_PASSWORD = "sebenza-dev-2026";

async function signInEmployer(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill("naledi.khumalo@discovery.co.za");
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/employer/, { timeout: 30_000 });
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

test("vacancy page: seat count, split outcomes, decline reason", async ({
  page,
}) => {
  await signInEmployer(page);
  await page.goto("/en/employer/vacancies");
  await page
    .getByRole("link", { name: /Senior Software Engineer/i })
    .first()
    .click();
  await page.waitForURL(/\/employer\/vacancies\/[^/]+$/, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  const strip = page.getByRole("region", {
    name: /vacancy invitation outcomes/i,
  });
  await strip.scrollIntoViewIfNeeded();
  await strip.screenshot({ path: `${OUT}/vacancy-outcomes-strip.png` });

  // The pipeline, where the decline reason now renders.
  const pipeline = page.locator("section", { hasText: "Pipeline ·" }).last();
  await pipeline.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await pipeline.screenshot({ path: `${OUT}/vacancy-pipeline.png` });
});

test("match page: the seat count that counts down", async ({ page }) => {
  await signInEmployer(page);
  await page.goto("/en/employer/vacancies");
  await page
    .getByRole("link", { name: /Senior Software Engineer/i })
    .first()
    .click();
  await page.waitForURL(/\/employer\/vacancies\/[^/]+$/, { timeout: 30_000 });
  await page.getByRole("link", { name: /find matches/i }).first().click();
  await page.waitForURL(/\/match/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/match-seat-count.png`, fullPage: false });
});
