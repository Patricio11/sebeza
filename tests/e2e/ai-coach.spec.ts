/**
 * Phase 17 ("AI Career Coach") — flag-gated seeker LLM surface.
 *
 * Two halves, both asserted here so the gating is provably symmetric:
 *  - Flag OFF (the dark-ship default): the "AI coach" nav item is hidden and
 *    /dashboard/coach 404s — no dead link, no surface.
 *  - Flag ON: the page renders and, with NO active provider configured (every
 *    seeded llm_providers row is dormant), the request degrades gracefully to a
 *    calm "not switched on yet" message instead of crashing or spending.
 *
 * The flag row is removed in afterAll so every other suite sees it OFF.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_seeker_ai_coach";

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

test("flag OFF: the AI coach nav item is hidden and the page 404s", async ({
  page,
}) => {
  await setFlag(false);
  await signInSeeker(page);

  await page.goto("/en/dashboard");
  await expect(page.getByRole("link", { name: "AI coach" })).toHaveCount(0);

  // The page gates with notFound() — assert the coach surface is unreachable
  // (the masthead + role field never render), regardless of soft/hard 404.
  await page.goto("/en/dashboard/coach");
  await expect(page.getByText("AI interview coach")).toHaveCount(0);
  await expect(page.locator("#coach-role")).toHaveCount(0);
});

test("flag ON: the coach renders and degrades gracefully with no provider", async ({
  page,
}) => {
  await setFlag(true);
  await signInSeeker(page);

  await page.goto("/en/dashboard/coach");
  await expect(page.getByText("AI interview coach")).toBeVisible();
  // Phase 22.3 — the structural "practice, not a promise" framing is always present.
  await expect(
    page.getByText(/not a real interview, and not a job offer/i),
  ).toBeVisible();

  await page.locator("#coach-role").fill("Junior software developer");
  await page
    .getByRole("button", { name: /get practice questions/i })
    .click();

  // No active provider in the seed → the dispatcher returns no_provider and the
  // client shows the calm unavailable message (not a crash, not questions).
  await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(/switched on yet|check back soon|try again|paused/i),
  ).toBeVisible();
  // Phase 22.4 — never a dead end: the human work-readiness guide is offered.
  await expect(
    page.getByRole("link", { name: /how to prepare for an interview/i }),
  ).toBeVisible();
});
