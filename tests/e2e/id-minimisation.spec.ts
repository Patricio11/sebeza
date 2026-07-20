/**
 * Phase 31 ("Data minimisation", plan: docs/PHASE_9_19_PLAN.md) — the
 * dormant-by-default ID/passport posture plus the two-class citizen
 * capture, end to end:
 *
 *   1. Sign-up asks ONE Yes/No citizen question — the 191-country picker
 *      is gone, and no ID/passport is requested anywhere.
 *   2. /dashboard/profile with the flag OFF (the launch default) shows a
 *      "Date of birth" section only — no ID field, no KYC upload prompt.
 *   3. Flipping the flag ON (simulating the post-partnership state)
 *      brings the full 9.16 capture surface back exactly as built.
 *   4. The admin ack-gated switch renders on /admin/verifications.
 *
 * Self-resetting: the flag row is deleted (→ default OFF) at start + end.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const FLAG = "feature_flag_id_verification_enabled";

let sql: ReturnType<typeof postgres> | null = null;

async function setFlag(on: boolean) {
  if (!sql) return;
  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES (${FLAG}, ${on ? "true" : "false"}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = ${on ? "true" : "false"}::jsonb
  `;
}

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing — see playwright.config.");
  sql = postgres(url, { max: 1 });
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  await sql.end();
  sql = null;
});

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.project.name}/${name}.png`,
    fullPage: false,
  });
}

async function dismissCookieBanner(page: Page) {
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

async function signIn(page: Page, email: string, urlRe: RegExp) {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(urlRe, { timeout: 30_000 });
}

test("sign-up: citizen Yes/No first; answering No reveals the country picker; no ID anywhere", async ({
  page,
}, testInfo) => {
  // /sign-up is the role chooser; the seeker form lives one level down.
  await page.goto("/en/sign-up/seeker");
  await dismissCookieBanner(page);

  await expect(
    page.getByText("Are you a South African citizen?"),
  ).toBeVisible();
  const citizenGroup = page.getByRole("radiogroup", {
    name: /south african citizen/i,
  });
  await expect(citizenGroup).toBeVisible();
  // "Never a gate" copy is load-bearing (Location-Not-Nationality rule).
  await expect(
    page.getByText(/never affects whether you can use Sebenza/i),
  ).toBeVisible();

  // Default (Yes = citizen): no country picker, no ID/passport capture.
  await expect(
    page.getByRole("button", { name: "Which country are you from?" }),
  ).toHaveCount(0);
  await expect(page.getByText(/passport/i)).toHaveCount(0);
  await shoot(page, testInfo, "idmin-1-signup-citizen-question");

  // Phase 31 hybrid (operator feedback 2026-07-20): answering No reveals
  // the country picker — nationality displays on the profile + search
  // rows, so non-citizens still say WHICH country. ZA is excluded.
  await citizenGroup.getByText("No", { exact: true }).click();
  // exact: true — after a selection, a "Clear Which country are you
  // from?" affordance also matches a substring name.
  const countryButton = page.getByRole("button", {
    name: "Which country are you from?",
    exact: true,
  });
  await expect(countryButton).toBeVisible();
  await countryButton.click();
  const picker = page.getByRole("dialog", { name: /country.*picker/i });
  await expect(picker).toBeVisible();
  // ZA is excluded from the non-citizen list ("not a citizen but from
  // South Africa" is contradictory — flip the toggle instead).
  await expect(
    picker.getByRole("option", { name: /^South Africa$/ }),
  ).toHaveCount(0);
  await picker.getByRole("combobox").fill("Zimba");
  await picker.getByRole("option", { name: /^Zimbabwe$/ }).first().click();
  await expect(countryButton).toContainText("Zimbabwe");
  await shoot(page, testInfo, "idmin-1b-signup-noncitizen-country");

  // Flipping back to Yes hides the picker again.
  await citizenGroup.getByText("Yes", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Which country are you from?" }),
  ).toHaveCount(0);
});

test("profile editor: flag OFF hides the ID surface; ON restores it", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await setFlag(false);

  await signIn(page, "andile-z@example.co.za", /\/dashboard(\/|$|\?)/);
  await dismissCookieBanner(page);
  await page.goto("/en/dashboard/profile");
  const main = page.getByRole("main");

  // OFF (the launch default): the section is Date-of-birth only.
  await expect(
    main.getByText("Sebenza does not ask for ID or passport numbers", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText(/upload your sa id document/i)).toHaveCount(0);
  await expect(main.getByText(/id number on file/i)).toHaveCount(0);
  await shoot(page, testInfo, "idmin-2-profile-flag-off");

  // ON (post-partnership): the full 9.16 surface returns. With no ID
  // stored yet, the ID controls offer "Add" and the KYC panel shows its
  // "add your national ID first" state.
  await setFlag(true);
  await page.reload();
  await expect(
    main.getByRole("heading", { name: "National ID", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText(/no id on file/i).first()).toBeVisible();
  await expect(
    main.getByText(/add your national id first/i),
  ).toBeVisible();
  await shoot(page, testInfo, "idmin-3-profile-flag-on");

  // Reset to the launch default and confirm it hides again.
  await setFlag(false);
  await page.reload();
  await expect(
    main.getByText("Sebenza does not ask for ID or passport numbers", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 15_000 });
});

test("admin: the ack-gated collection switch renders on the Seeker IDs tab", async ({
  page,
}, testInfo) => {
  await setFlag(false);
  await signIn(page, "admin@sebenzasa.com", /\/admin/);
  await dismissCookieBanner(page);
  await page.goto("/en/admin/verifications?tab=seeker-ids");

  const switchCard = page.getByRole("region", {
    name: /id \/ passport collection/i,
  });
  await expect(switchCard).toBeVisible({ timeout: 15_000 });
  await expect(switchCard.getByText("OFF", { exact: true })).toBeVisible();
  // The enable button is ack-gated: disabled until the checkbox is ticked.
  const enableBtn = switchCard.getByRole("button", {
    name: /enable id \/ passport collection/i,
  });
  await expect(enableBtn).toBeDisabled();
  await switchCard.getByRole("checkbox").check();
  await expect(enableBtn).toBeEnabled();
  await shoot(page, testInfo, "idmin-4-admin-switch");
});
