/**
 * Phase 20.2 ("Unlocks next")  flag-gated nudge on the Career Compass.
 *
 * We give andile-z the prerequisite `pool-rescue` (which he lacks in the seed);
 * the seeded edge open-water-rescue → pool-rescue then means he now holds the
 * stepping stone but not the dependent. With the flag ON the "Unlocks next"
 * card surfaces "Open water rescue"; with it OFF the card is absent.
 *
 * The seeded skill row + the flag are cleaned up in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const FLAG = "feature_flag_skill_prereqs";
const PREREQ_SLUG = "pool-rescue";

let sql: ReturnType<typeof postgres> | null = null;
let profileId = "";

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing  playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM profiles WHERE handle = 'andile-z' LIMIT 1
  `;
  profileId = rows[0]?.id ?? "";
  await sql`
    INSERT INTO profile_skills (profile_id, skill_slug, proficiency, provenance)
    VALUES (${profileId}, ${PREREQ_SLUG}, 3, 'self_attested')
    ON CONFLICT DO NOTHING
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`
    DELETE FROM profile_skills
    WHERE profile_id = ${profileId} AND skill_slug = ${PREREQ_SLUG}
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

test("flag OFF: no Unlocks-next card", async ({ page }) => {
  await setFlag(false);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Unlocks next")).toHaveCount(0);
});

test("flag ON: the Unlocks-next card surfaces the unlocked skill", async ({
  page,
}) => {
  await setFlag(true);
  await signInSeeker(page);
  await page.goto("/en/dashboard/grow");

  const card = page.getByRole("region", { name: "Unlocks next" });
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Open water rescue", { exact: true }),
  ).toBeVisible();
});
