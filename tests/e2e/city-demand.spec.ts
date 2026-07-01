/**
 * Phase 21.2 ("Hyper-Local Demand") — flag-gated "Your city's hotspots" surface.
 *
 * andile-z lives in Johannesburg (a top-5 metro) and has outcomes_research
 * consent, and the seed ships Johannesburg city demand — so with the flag ON
 * the hotspots card renders; with it OFF the compass is unchanged. The card sits
 * in a lazy-loaded section, so we scroll to trigger it. The consent + metro +
 * floor gates themselves are proven at the query layer (city-demand-gates.test).
 *
 * The flag is cleaned up in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_city_demand";

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

async function scrollToBottom(page: Page): Promise<void> {
  // The city-demand section is lazy-loaded (IntersectionObserver); scroll it in.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
  }
}

test("flag OFF: no city hotspots card", async ({ page }) => {
  await setFlag(false);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await scrollToBottom(page);
  await expect(page.getByText(/Your city.s hotspots/)).toHaveCount(0);
});

test("flag ON: the city hotspots card renders for a consenting metro seeker", async ({
  page,
}) => {
  await setFlag(true);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await scrollToBottom(page);

  const card = page.getByRole("region", { name: /Your city.s hotspots/ });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Software Developer").first()).toBeVisible();
});
