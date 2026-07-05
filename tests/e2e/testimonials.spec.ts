/**
 * Phase 24 ("Testimonials") — the full loop, campaign-gated:
 *
 *  1. Campaign OFF (default): no collection card on the dashboard; the landing
 *     rail is absent (zero approved).
 *  2. Campaign ON: the seeker sees the card; submitting requires the explicit
 *     public-display consent; after submitting they're thanked and NEVER see
 *     the card again (prompt state).
 *  3. Admin approves the submission → it renders on the landing rail with the
 *     captured display fields.
 *
 * All rows + the campaign setting are cleaned up in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "lerato-n@example.co.za";
const ADMIN_EMAIL = "admin@sebenzasa.com";
const CAMPAIGN_KEY = "testimonial_campaign_active";
const QUOTE = "Sebenza moved my profile in front of real employers within a week.";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  // Deterministic start.
  await sql`DELETE FROM testimonials`;
  await sql`DELETE FROM testimonial_prompt_state`;
  await sql`DELETE FROM platform_settings WHERE key = ${CAMPAIGN_KEY}`;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM testimonials`;
  await sql`DELETE FROM testimonial_prompt_state`;
  await sql`DELETE FROM platform_settings WHERE key = ${CAMPAIGN_KEY}`;
  await sql.end();
  sql = null;
});

async function setCampaign(on: boolean) {
  if (!sql) throw new Error("sql not ready");
  if (on) {
    await sql`
      INSERT INTO platform_settings (key, value)
      VALUES (${CAMPAIGN_KEY}, 'true'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
    `;
  } else {
    await sql`DELETE FROM platform_settings WHERE key = ${CAMPAIGN_KEY}`;
  }
}

async function signIn(page: Page, email: string, urlRe: RegExp) {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(urlRe, { timeout: 30_000 });
}

test("campaign OFF: no collection card, no landing rail", async ({ page }) => {
  await setCampaign(false);
  await signIn(page, SEEKER_EMAIL, /\/dashboard/);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Your words, if you'd like")).toHaveCount(0);

  await page.goto("/en");
  await expect(page.getByText("In their words")).toHaveCount(0);
});

test("campaign ON: submit with consent → thanked → never asked again → admin approves → landing rail", async ({
  page,
}) => {
  // Self-resetting: the desktop + mobile projects share the DB, and this flow
  // consumes the seeker's one-time prompt — start each run fresh.
  if (sql) {
    await sql`DELETE FROM testimonials`;
    await sql`DELETE FROM testimonial_prompt_state`;
  }
  await setCampaign(true);

  // 1. The seeker sees the card and submits (consent required).
  await signIn(page, SEEKER_EMAIL, /\/dashboard/);
  const main = page.getByRole("main");
  const card = main.getByLabel("Share your experience");
  await expect(card).toBeVisible();

  await card.getByPlaceholder("What changed for you?").fill(QUOTE);
  // Share stays disabled until consent is ticked.
  await expect(card.getByRole("button", { name: "Share" })).toBeDisabled();
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Share" }).click();
  await expect(
    card.getByText(/Thank you .* review it before anything is shown/i),
  ).toBeVisible({ timeout: 30_000 });

  // 2. Reload: the card never comes back after submission.
  await page.reload();
  await expect(page.getByText("Your words, if you'd like")).toHaveCount(0);

  // 3. Admin approves it.
  await page.context().clearCookies();
  await signIn(page, ADMIN_EMAIL, /\/admin/);
  await page.goto("/en/admin/testimonials");
  // clearCookies reset the cookie-consent choice — the banner reappears and
  // intercepts taps on 360px; dismiss it robustly (auto-waits, no race).
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
  const adminMain = page.getByRole("main");
  await expect(adminMain.getByText(QUOTE)).toBeVisible();
  await adminMain.getByRole("button", { name: /^Approve$/ }).first().click();
  await expect(adminMain.getByText(/APPROVED/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // 4. The landing rail renders it, with the captured display fields.
  await page.goto("/en");
  await expect(page.getByText("In their words")).toBeVisible();
  await expect(page.getByText(QUOTE)).toBeVisible();
  await expect(page.getByText(/Shared with consent/i).first()).toBeVisible();
});
