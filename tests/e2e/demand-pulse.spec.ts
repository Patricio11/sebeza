/**
 * Phase 17 ("Demand Pulse") — flag-gated seeker demand-spike card.
 *
 * Flag OFF (the dark-ship default) = no card; covered by the other seeker
 * specs. Here we flip `feature_flag_seeker_demand_pulse` ON and seed a genuine
 * this-week spike in employer searches for andile-z's profession in his
 * province, then assert the dashboard surfaces the "Demand pulse" card. The
 * seeded search_events + the flag row are restored in afterAll, so every other
 * suite sees the flag OFF and an untouched seed.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_seeker_demand_pulse";
const EVENT_PREFIX = "se_dp_test_";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });

  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES (${FLAG}, 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
  `;

  const [prof] = await sql<{ profession: string; province: string }[]>`
    SELECT profession, province FROM profiles WHERE handle = 'andile-z' LIMIT 1
  `;
  if (prof) {
    const provinceSlug = prof.province.toLowerCase().replace(/\s+/g, "-");
    // 8 this-week searches for the profession in the province → a clear spike
    // over any seed baseline (this_week >= 8, prior ≈ 0).
    for (let i = 0; i < 8; i++) {
      await sql`
        INSERT INTO search_events (id, terms, filters, result_count, at)
        VALUES (
          ${EVENT_PREFIX + i},
          ${prof.profession},
          ${sql.json({ province: provinceSlug })},
          3,
          now() - (${i} || ' hours')::interval
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM search_events WHERE id LIKE ${EVENT_PREFIX + "%"}`;
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

test("Demand Pulse surfaces the heating-skill card when the flag is on + demand spikes", async ({
  page,
}) => {
  await signInSeeker(page);
  await page.goto("/en/dashboard");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Demand pulse", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("heating up", { exact: false }).first()).toBeVisible();
});
