/**
 * 2026-08-19  founder-reported profile editor issues:
 *   1. "Also experienced in" offered no way to suggest a missing
 *      profession (every other picker does).
 *   2. Its dropdown ran off to the right: the root div used
 *      `className ?? "relative"`, so the caller's `md:col-span-2`
 *      REPLACED `relative` and the absolute panel resolved against a
 *      distant ancestor.
 *   3. "About" did not span the row: TextareaField put `className` on
 *      the <textarea>, not on the field block.
 *
 * Screenshots land in docs/screenshots/profile-form-fixes/.
 */
import { test, expect, type Page } from "@playwright/test";

const OUT = "docs/screenshots/profile-form-fixes";
const SEED_PASSWORD = "sebenza-dev-2026";

test.use({ viewport: { width: 1280, height: 900 } });

async function signIn(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill("andile-z@example.co.za");
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

test("dropdown stays inside its field and offers a suggestion", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/en/dashboard/profile");

  const field = page.getByRole("combobox", {
    name: /also experienced in/i,
  });
  await field.scrollIntoViewIfNeeded();
  await field.click();
  await field.fill("Project Management");

  // The suggest affordance the founder asked for.
  const suggest = page.getByText(/my profession isn't listed/i);
  await expect(suggest).toBeVisible();

  // Geometry: the panel must not be wider than the field it belongs to.
  const listbox = page.getByRole("listbox").first();
  const fieldBox = await field.boundingBox();
  const listBox = await listbox.boundingBox();
  expect(fieldBox && listBox).toBeTruthy();
  expect(listBox!.width).toBeLessThanOrEqual(fieldBox!.width + 2);
  expect(Math.abs(listBox!.x - fieldBox!.x)).toBeLessThan(4);

  await page.screenshot({ path: `${OUT}/01-suggest-and-dropdown.png` });
});

test("About spans the full row", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard/profile");

  const about = page.locator("#bio");
  await about.scrollIntoViewIfNeeded();
  // #displayName is a known half-row field in the same grid.
  const halfRow = page.locator("#displayName");
  const aboutBox = await about.boundingBox();
  const halfBox = await halfRow.boundingBox();
  expect(aboutBox && halfBox).toBeTruthy();
  // A full-row field is materially wider than a half-row one.
  expect(aboutBox!.width).toBeGreaterThan(halfBox!.width * 1.5);
  await page.screenshot({ path: `${OUT}/02-about-full-row.png` });
});
