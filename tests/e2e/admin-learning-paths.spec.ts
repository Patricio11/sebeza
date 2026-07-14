/**
 * Phase 18.2 ("Living Learning Catalog")  the editorial / freshness admin.
 *
 * Proves the freshness loop end-to-end: a path that's gone 90+ days unverified
 * surfaces in the "Needs re-verification" rail; an admin re-verifies it and it
 * clears. Plus the curation loop: remove a path, then restore it.
 *
 * One path is forced stale in beforeAll; afterAll restores every path to fresh
 * + active so other suites see an untouched catalog.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const ADMIN_EMAIL = "admin@sebenzasa.com";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing  playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  // Force the first path stale so the re-verification rail has one entry.
  await sql`
    UPDATE learning_paths
    SET last_verified_at = now() - interval '200 days'
    WHERE id = (SELECT id FROM learning_paths ORDER BY sort_order LIMIT 1)
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  // Restore: every path fresh + active.
  await sql`UPDATE learning_paths SET last_verified_at = now(), deleted_at = NULL`;
  await sql.end();
  sql = null;
});

async function signInAdmin(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
}

test("admin re-verifies a stale path and it clears the rail", async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto("/en/admin/learning-paths");

  await expect(
    page.getByRole("heading", { name: "Needs re-verification" }),
  ).toBeVisible();
  const verifyNow = page.getByRole("button", { name: /verify now/i });
  await expect(verifyNow.first()).toBeVisible();
  const staleBefore = await verifyNow.count();

  await verifyNow.first().click();

  // After re-verification the rail loses that path. Count-based + a generous
  // timeout (the first server action on a cold worker can be slow).
  await expect(verifyNow).toHaveCount(staleBefore - 1, { timeout: 30_000 });
});

test("admin can remove and restore a path", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/en/admin/learning-paths");

  await expect(
    page.getByRole("heading", { name: /All paths/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Remove$/ }).first().click();

  const restore = page.getByRole("button", { name: /^Restore$/ });
  await expect(restore.first()).toBeVisible({ timeout: 15_000 });

  await restore.first().click();
  await expect(page.getByRole("button", { name: /^Restore$/ })).toHaveCount(0, {
    timeout: 15_000,
  });
});
