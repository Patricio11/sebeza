/**
 * Phase 20.1 ("Skill Prerequisites")  flag-gated "Requires:" pill on the
 * Career Compass.
 *
 * We seed heavy employer demand for "open water rescue" (a skill the BSc-CS
 * seeker andile-z lacks), so it surfaces as a recommendation. The seed already
 * ships the edge open-water-rescue → pool-rescue, and andile lacks pool-rescue,
 * so with the flag ON the card must show a "Requires: Pool rescue" pill; with
 * the flag OFF the same recommendation appears without it.
 *
 * The seeded search_events + the flag are cleaned up in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_skill_prereqs";
const PREFIX = "se_pr_test_";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing  playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  // Heavy demand for "open water rescue" → it dominates the recommendation set.
  for (let i = 0; i < 50; i++) {
    await sql`
      INSERT INTO search_events (id, terms, result_count, at)
      VALUES (${PREFIX + i}, 'open water rescue', 3, now() - (${i} || ' minutes')::interval)
      ON CONFLICT (id) DO NOTHING
    `;
  }
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM search_events WHERE id LIKE ${PREFIX + "%"}`;
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

test("flag OFF: the recommendation shows without a Requires pill", async ({
  page,
}) => {
  await setFlag(false);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await expect(page.getByText("Open water rescue").first()).toBeVisible();
  await expect(page.getByText(/Requires/)).toHaveCount(0);
});

test("flag ON: the recommendation shows the unmet-prerequisite pill", async ({
  page,
}) => {
  await setFlag(true);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await expect(page.getByText("Open water rescue").first()).toBeVisible();
  await expect(page.getByText(/Requires.*Pool rescue/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
