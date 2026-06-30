/**
 * Phase 18.1 ("Living Learning Catalog") — flag-gated seeker path-review loop.
 *
 * Flag OFF (the dark-ship default) = the learning-path cards on /dashboard/grow
 * are exactly as before (no review control). Flag ON = each card gains a "Took
 * this path?" recommend control; submitting it persists + confirms.
 *
 * The flag row, any reviews the test creates, and the path roll-up counts are
 * all restored in afterAll so every other suite sees the seed untouched.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_living_catalog";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
});

test.afterAll(async () => {
  if (!sql) return;
  // Restore the seed: drop any reviews the test created + zero the roll-ups.
  await sql`DELETE FROM learning_path_reviews`;
  await sql`UPDATE learning_paths SET review_count = 0, recommend_count = 0`;
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  await sql.end();
  sql = null;
});

async function setFlag(on: boolean): Promise<void> {
  if (!sql) throw new Error("sql not ready");
  if (on) {
    await sql`
      INSERT INTO platform_settings (key, value)
      VALUES (${FLAG}, 'true'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
    `;
  } else {
    await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  }
}

async function signInSeeker(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("flag OFF: learning-path cards have no review control", async ({ page }) => {
  await setFlag(false);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await expect(page.locator("main")).toBeVisible();
  // The flag-ON test proves the cards + control render for this same seeker;
  // here the control must be absent when the flag is off.
  await expect(page.getByText("Took this path?")).toHaveCount(0);
});

test("flag ON: a path can be reviewed and the submission is confirmed", async ({
  page,
}) => {
  await setFlag(true);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");

  const prompt = page.getByText("Took this path?").first();
  await expect(prompt).toBeVisible();

  // Recommend the first card's path.
  await page.getByRole("button", { name: /^Recommend$/ }).first().click();

  await expect(
    page.getByText(/Thanks .* feedback helps other seekers/i).first(),
  ).toBeVisible({ timeout: 15_000 });
});
