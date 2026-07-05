/**
 * Phase 20 (20.0) — the skill-prerequisite admin + its cycle guard.
 *
 * The seed ships a starter graph (e.g. postgres → sql). Here we prove the write
 * path: an edge that would close a loop (sql → postgres) is refused, and a fresh
 * valid edge (node → typescript) is accepted and listed. The added edge is
 * removed in afterAll so the seeded graph is the only thing left.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const ADMIN_EMAIL = "admin@sebenzasa.com";
const REASON = "Zzprereqtestreason";

let sql: ReturnType<typeof postgres> | null = null;

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  // Deterministic start: clear the test edge in case a prior run's afterAll was
  // interrupted (e.g. a webserver/DB hiccup), so the "valid add" is always fresh.
  await sql`DELETE FROM skill_prereqs WHERE skill_slug = 'node' AND prereq_skill_slug = 'typescript'`;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM skill_prereqs WHERE skill_slug = 'node' AND prereq_skill_slug = 'typescript'`;
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

test("cycle is rejected and a valid prerequisite is added", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/en/admin/skill-prereqs");

  // Robustly dismiss the cookie banner: `click` auto-waits for it to appear
  // (up to the timeout), so we don't race a point-in-time visibility check and
  // then have the bottom banner intercept a form click on 360px.
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});

  // Scope every locator to <main>: Next's streaming navigation can transiently
  // leave a duplicate of the outgoing page's DOM outside main, which trips
  // strict mode on bare selectors (root cause of the recurring flake here).
  const main = page.getByRole("main");

  // Seeded graph renders.
  await expect(
    main.getByRole("heading", { name: /^Prerequisites/ }),
  ).toBeVisible();

  const skillSel = main.getByLabel("Skill", { exact: true });
  const prereqSel = main.getByLabel("Prerequisite", { exact: true });
  const reason = main.getByPlaceholder("Why this ordering?");
  const addBtn = main.getByRole("button", { name: "Add prerequisite" });

  // 1. Cycle: postgres already requires sql, so sql → postgres must be refused.
  await skillSel.selectOption("sql");
  await prereqSel.selectOption("postgres");
  await reason.fill("should fail");
  await addBtn.click();
  await expect(main.getByText(/cycle/i)).toBeVisible({ timeout: 30_000 });

  // 2. Valid: node → typescript is accepted and listed.
  await skillSel.selectOption("node");
  await prereqSel.selectOption("typescript");
  await reason.fill(REASON);
  await addBtn.click();
  await expect(main.getByText(REASON)).toBeVisible({ timeout: 30_000 });
});
