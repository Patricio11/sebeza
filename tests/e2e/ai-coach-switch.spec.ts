/**
 * Phase 22.5 — the system-wide AI Coach switch on /admin/llm (Integrations).
 *
 * Turning the coach ON is a deliberate, acknowledged act: the "Enable" button
 * stays disabled until the safety-review acknowledgement is ticked. Turning OFF
 * is always immediate. We drive the full ack → enable → disable cycle and
 * restore the flag OFF in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const ADMIN_EMAIL = "admin@sebenzasa.com";
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

async function signInAdmin(page: Page): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
}

test("the AI Coach switch is acknowledgement-gated (enable → disable)", async ({
  page,
}) => {
  // Start from OFF (the dark-ship default).
  if (sql) await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;

  await signInAdmin(page);
  await page.goto("/en/admin/llm");
  // Robustly dismiss the cookie banner (auto-waits for it, so we don't race a
  // point-in-time check and let the bottom banner intercept a click on 360px).
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});

  const region = page.getByRole("region", { name: /AI Career Coach/ });
  await expect(region).toBeVisible();

  // Phase 22.6 — the safety telemetry panel is present on Integrations.
  await expect(
    page.getByRole("region", { name: "AI Coach safety telemetry" }),
  ).toBeVisible();

  // Enable is blocked until the safety acknowledgement is ticked.
  const enableBtn = region.getByRole("button", { name: /Enable AI Coach/i });
  await expect(enableBtn).toBeDisabled();

  await region.getByRole("checkbox").check();
  await expect(enableBtn).toBeEnabled();

  await enableBtn.click();

  // Now ON — the immediate OFF control appears.
  const offBtn = region.getByRole("button", { name: /Turn OFF/i });
  await expect(offBtn).toBeVisible({ timeout: 30_000 });

  // Turning OFF is immediate (no acknowledgement).
  await offBtn.click();
  await expect(
    region.getByRole("button", { name: /Enable AI Coach/i }),
  ).toBeVisible({ timeout: 30_000 });
});
