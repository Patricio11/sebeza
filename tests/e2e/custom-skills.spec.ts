/**
 * Phase 19.1 ("Custom Skills") — flag-gated seeker escape hatch on
 * /dashboard/profile.
 *
 * Flag OFF (the dark-ship default) = no "Self-described skills" section. Flag
 * ON = the seeker can add a niche skill below the taxonomy picker; it persists
 * and can be removed. The flag + any rows the test creates are cleaned up in
 * afterAll. (The not-searchable invariant is proven at the data layer in
 * tests/integration/custom-skills-not-searchable.test.ts.)
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_seeker_custom_skills";
const SKILL = "Permaculture design";

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
  await sql`
    DELETE FROM profile_skills_custom
    WHERE profile_id IN (SELECT id FROM profiles WHERE handle = 'andile-z')
  `;
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

test("flag OFF: no self-described skills section", async ({ page }) => {
  await setFlag(false);
  await signInSeeker(page);
  await page.goto("/en/dashboard/profile");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Self-described skills")).toHaveCount(0);
});

test("flag ON: a seeker can add then remove a custom skill", async ({
  page,
}) => {
  await setFlag(true);
  await signInSeeker(page);
  await page.goto("/en/dashboard/profile");

  // Scope to <main> — Next's streaming nav can transiently duplicate the
  // outgoing DOM outside main, tripping strict mode on bare selectors.
  const main = page.getByRole("main");
  await expect(main.getByText("Self-described skills")).toBeVisible();

  await main.locator("#custom-skill-label").fill(SKILL);
  await main.getByRole("button", { name: "Add custom skill" }).click();

  // The first server action + full profile-page refresh on a cold worker can
  // be slow, so allow a generous window.
  const chip = main.getByText(SKILL, { exact: true });
  await expect(chip).toBeVisible({ timeout: 30_000 });

  await main.getByRole("button", { name: `Remove ${SKILL}` }).click();
  await expect(main.getByText(SKILL, { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
});
