/**
 * 2026-08  visual walk for the compass wave (COMPASS_FUEL_PLAN).
 * Saves founder-facing screenshots to docs/screenshots/compass-wave/.
 * A pending catalogue draft is seeded so the review card renders.
 */
import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const OUT = "docs/screenshots/compass-wave";
const DRAFT_ID = "cd_visual-walk-demo";
let sql: ReturnType<typeof postgres> | null = null;

test.use({ viewport: { width: 1280, height: 900 } });

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
  const [admin] = await sql`SELECT id FROM app_user WHERE role='admin' LIMIT 1`;
  await sql`DELETE FROM catalog_drafts WHERE id = ${DRAFT_ID}`;
  await sql`
    INSERT INTO catalog_drafts (id, skill_slugs, payload, state, raw_model, created_by_user_id)
    VALUES (
      ${DRAFT_ID}, ARRAY['python'],
      ${sql.json({
        title: "Python for Data Careers (free)",
        provider: "ALX Africa",
        providerKind: "open",
        cost: "free",
        costNote: null,
        outcome: "Job-ready Python fundamentals with a portfolio project",
        durationWeeks: 12,
        unlocksSkills: ["Python"],
        national: true,
        url: null,
      })},
      'pending', 'demo-model', ${admin!.id})`;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM catalog_drafts WHERE id = ${DRAFT_ID}`;
  await sql.end();
});

test("seeker: compass explainer + blended demand", async ({ page }) => {
  await signIn(page, "andile-z@example.co.za");
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await dismissCookies(page);

  await page.goto("/en/dashboard/grow");
  await expect(page.getByText("How your compass works")).toBeVisible();
  await page.screenshot({ path: `${OUT}/01-compass-explainer.png` });
  await page.screenshot({ path: `${OUT}/02-compass-full.png`, fullPage: true });
});

test("admin: draft-with-AI panel with a pending draft card", async ({ page }) => {
  await signIn(page, "admin@sebenzasa.com");
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  await dismissCookies(page);

  await page.goto("/en/admin/learning-paths");
  await expect(page.getByText("Draft catalogue entries with AI")).toBeVisible();
  // Draft fields render as editable inputs, not text nodes.
  await expect(page.getByLabel("Title").first()).toHaveValue(
    "Python for Data Careers (free)",
  );
  await page.screenshot({ path: `${OUT}/03-admin-draft-panel.png` });
});
