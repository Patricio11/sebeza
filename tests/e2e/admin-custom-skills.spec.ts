/**
 * Phase 19.2 ("Custom Skills — canonicalization") — the admin promotes a
 * frequently-claimed custom label into the searchable taxonomy.
 *
 * Seeds one custom skill for a seeker, then drives the admin leaderboard:
 * Promote → confirm → the label leaves the board, a canonical `skills` row
 * exists, and the holder has been migrated into `profile_skills` (which the
 * existing trigger makes searchable). All seeded + created rows are removed in
 * afterAll so the taxonomy + the seeker's skills return to the seed state.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const ADMIN_EMAIL = "admin@sebenzasa.com";
const HANDLE = "andile-z";
const LABEL = "Solar panel installation";
const NORM = LABEL.toLowerCase();
const SLUG = "solar-panel-installation";
const ROW_ID = "psc_test_canon";

let sql: ReturnType<typeof postgres> | null = null;
let profileId = "";

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM profiles WHERE handle = ${HANDLE} LIMIT 1
  `;
  profileId = rows[0]?.id ?? "";
  await sql`
    INSERT INTO profile_skills_custom (id, profile_id, label, label_normalized, proficiency)
    VALUES (${ROW_ID}, ${profileId}, ${LABEL}, ${NORM}, 4)
    ON CONFLICT (id) DO NOTHING
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM profile_skills WHERE skill_slug = ${SLUG}`;
  await sql`DELETE FROM skills WHERE slug = ${SLUG}`;
  await sql`DELETE FROM profile_skills_custom WHERE label_normalized = ${NORM}`;
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

test("admin promotes a custom skill to canonical and holders migrate", async ({
  page,
}) => {
  await signInAdmin(page);
  await page.goto("/en/admin/custom-skills");

  // Dismiss the cookie-consent banner — on 360px it sits at the bottom and
  // would intercept clicks on the promote panel.
  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
  }

  const row = page.getByRole("listitem").filter({ hasText: LABEL });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /promote to canonical/i }).click();
  // Slug pre-fills from the label.
  await expect(page.locator(`input[id^="slug-"]`).first()).toHaveValue(SLUG);
  // Scroll into view first — on 360px the confirm button can sit under the
  // persistent dashboard chrome otherwise.
  const confirmBtn = page.getByRole("button", { name: /confirm promote/i });
  await confirmBtn.scrollIntoViewIfNeeded();
  await confirmBtn.click();

  // The label leaves the leaderboard after promotion.
  await expect(page.getByText(LABEL, { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });

  // The data outcome: a canonical skill exists + the holder was migrated.
  const skill = await sql!`SELECT slug FROM skills WHERE slug = ${SLUG}`;
  expect(skill.length).toBe(1);
  const migrated = await sql!`
    SELECT 1 FROM profile_skills
    WHERE profile_id = ${profileId} AND skill_slug = ${SLUG}
  `;
  expect(migrated.length).toBe(1);
  const retired = await sql!`
    SELECT deleted_at FROM profile_skills_custom WHERE id = ${ROW_ID}
  `;
  expect(retired[0]?.deleted_at).not.toBeNull();
});
