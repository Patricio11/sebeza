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

  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
  }

  // Seeded graph renders.
  await expect(
    page.getByRole("heading", { name: /^Prerequisites/ }),
  ).toBeVisible();

  const skillSel = page.getByLabel("Skill", { exact: true });
  const prereqSel = page.getByLabel("Prerequisite", { exact: true });
  const reason = page.getByPlaceholder("Why this ordering?");
  const addBtn = page.getByRole("button", { name: "Add prerequisite" });

  // 1. Cycle: postgres already requires sql, so sql → postgres must be refused.
  await skillSel.selectOption("sql");
  await prereqSel.selectOption("postgres");
  await reason.fill("should fail");
  await addBtn.click();
  await expect(page.getByText(/cycle/i)).toBeVisible({ timeout: 15_000 });

  // 2. Valid: node → typescript is accepted and listed.
  await skillSel.selectOption("node");
  await prereqSel.selectOption("typescript");
  await reason.fill(REASON);
  await addBtn.click();
  await expect(page.getByText(REASON)).toBeVisible({ timeout: 30_000 });
});
