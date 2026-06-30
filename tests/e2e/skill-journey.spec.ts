/**
 * Phase 17 ("The Climb") — flag-gated seeker skill journey.
 *
 * With `feature_flag_seeker_skill_journey` OFF (the dark-ship default), the
 * Career Compass renders exactly as before — covered by the other seeker
 * specs. This spec flips the flag ON, seeds one in-progress learning item for
 * andile-z, and asserts the two new surfaces render:
 *   - the growth-momentum card (the visible rank payoff), and
 *   - per-item progress checkpoints on the active learning item.
 * The flag row + seeded item are restored in afterAll, so every other suite
 * sees the flag OFF (default) and an untouched seed.
 *
 * `getSetting` is React-cached per request + the page is dynamic, so the DB
 * change (same instance the webServer reads) is visible on the next load.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_seeker_skill_journey";
const LEARN_ID = "lrn_e2e_climb_test";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });

  // Flip the flag ON for this spec only.
  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES (${FLAG}, 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
  `;

  // Give andile-z one in-progress learning item so the progress UI renders.
  const [p] = await sql<{ id: string }[]>`
    SELECT id FROM profiles WHERE handle = 'andile-z' LIMIT 1
  `;
  if (p) {
    await sql`
      INSERT INTO learning_items
        (id, profile_id, skill_slug, title, provider, resource_kind, is_free, state, progress_percent)
      VALUES
        (${LEARN_ID}, ${p.id}, 'react', 'Learn React', 'web.dev', 'open', true, 'in_progress', 25)
      ON CONFLICT (id) DO UPDATE SET state = 'in_progress', progress_percent = 25
    `;
  }
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM learning_items WHERE id = ${LEARN_ID}`;
  // Back to the dark-ship default (no row → DEFAULTS = false).
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

test("The Climb surfaces the growth momentum + progress checkpoints when the flag is on", async ({
  page,
}) => {
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await expect(page.locator("main")).toBeVisible();

  // The growth-momentum card (visible rank payoff) — eyebrow "Your growth".
  await expect(page.getByText("Your growth", { exact: false }).first()).toBeVisible();

  // Per-item self-paced progress on the seeded in-progress item.
  await expect(page.getByText("Your progress", { exact: false }).first()).toBeVisible();
});
