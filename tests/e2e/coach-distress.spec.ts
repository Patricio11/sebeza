/**
 * Phase 22.2 ("AI Coach  crisis pathway")  the load-bearing safety test.
 *
 * When a seeker types something that reads as distress, the coach must route to
 * HUMAN crisis support, not the LLM  and it must do so BEFORE the provider
 * gate, so it works even with no provider configured (as in the seed). We flip
 * the flag ON, activate a test crisis resource, submit a distress phrase, and
 * assert: the crisis-support block + its resource render, and the normal
 * "not available / questions" flow does NOT appear (proving no provider call).
 *
 * The flag + the test resource are removed in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_seeker_ai_coach";
const RES_ID = "cr_e2e_test";
const RES_NAME = "E2E Crisis Test Line";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing  playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES (${FLAG}, 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
  `;
  await sql`
    INSERT INTO crisis_resources (id, name, contact, active, sort_order)
    VALUES (${RES_ID}, ${RES_NAME}, 'test contact', true, 100)
    ON CONFLICT (id) DO NOTHING
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM crisis_resources WHERE id = ${RES_ID}`;
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  await sql.end();
  sql = null;
});

async function signInSeeker(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("a distress input routes to human crisis support, not the model", async ({
  page,
}) => {
  await signInSeeker(page);
  await page.goto("/en/dashboard/coach");
  await expect(page.getByText("AI interview coach")).toBeVisible();

  await page.locator("#coach-role").fill("I want to die");
  await page.getByRole("button", { name: /get practice questions/i }).click();

  // Crisis support renders (calm + human), with the universal emergency line
  // and the active resource.
  const crisis = page.getByRole("status", { name: "Crisis support" });
  await expect(crisis).toBeVisible({ timeout: 15_000 });
  await expect(crisis.getByText(/emergency services/i)).toBeVisible();
  await expect(crisis.getByText(RES_NAME)).toBeVisible();

  // The provider path was NOT taken: no "not available" message, no questions
  // list (exact match so it doesn't catch the "Get practice questions" button).
  await expect(page.getByText(/switched on yet|check back soon/i)).toHaveCount(0);
  await expect(page.getByText("Practice questions", { exact: true })).toHaveCount(0);
});
