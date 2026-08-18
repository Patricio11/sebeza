/**
 * 2026-08  one-off VISUAL walk for the selfie-verification wave.
 * Saves founder-facing screenshots to docs/screenshots/selfie-wave/.
 * Fake camera flags let the dialog reach the live-camera stage.
 */
import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";

const FLAG = "feature_flag_selfie_verification";
const SEED_PASSWORD = "sebenza-dev-2026";
const OUT = "docs/screenshots/selfie-wave";
let sql: ReturnType<typeof postgres> | null = null;

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-capture",
    ],
  },
  permissions: ["camera"],
  viewport: { width: 1280, height: 900 },
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function dismissCookies(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  sql = postgres(url, { max: 1 });
  await sql`
    INSERT INTO platform_settings (key, value) VALUES (${FLAG}, 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb`;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  await sql.end();
});

test("seeker: selfie card, dialog, camera stage, qualifications rail", async ({
  page,
}) => {
  await signIn(page, "andile-z@example.co.za");
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await dismissCookies(page);

  await page.goto("/en/dashboard/profile");
  const card = page.getByText("Verify your profile with a live selfie");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/01-profile-selfie-card.png` });

  await page.getByRole("button", { name: /verify my profile/i }).click();
  await expect(page.getByText("Start camera check")).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-selfie-consent.png` });

  await page.getByRole("button", { name: /start camera check/i }).click();
  // Fake camera: reaches the live stage; gestures can't complete without
  // a real face, which is exactly what we want to show (the prompt UI).
  await expect(
    page.getByText(/look straight at the camera|starting camera/i),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/03-selfie-camera-stage.png` });
  await page.keyboard.press("Escape");

  await page.goto("/en/dashboard/qualifications");
  await expect(page.getByText("Qualifications are self-declared.")).toBeVisible();
  await page.screenshot({
    path: `${OUT}/04-qualifications-self-declared.png`,
    fullPage: true,
  });
});

test("admin: storage card, taxonomy search+edit, org queue search+delete", async ({
  page,
}) => {
  await signIn(page, "admin@sebenzasa.com");
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  await dismissCookies(page);

  await page.goto("/en/admin/integrations");
  await expect(page.getByText("Storage (files)")).toBeVisible();
  await page.screenshot({ path: `${OUT}/05-admin-storage-card.png`, fullPage: true });

  await page.goto("/en/admin/taxonomy");
  await expect(page.getByLabel("Search professions")).toBeVisible();
  await page.getByLabel("Search professions").fill("tech");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/06-admin-taxonomy-search.png` });

  await page.goto("/en/admin/verifications?tab=organisations");
  await expect(page.getByLabel("Search organisations")).toBeVisible();
  await page.screenshot({
    path: `${OUT}/07-admin-org-queue.png`,
    fullPage: true,
  });
});
