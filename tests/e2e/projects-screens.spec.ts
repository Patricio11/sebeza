/**
 * 2026-08-19  visual walk for "Work & projects".
 * Screenshots → docs/screenshots/projects-wave/.
 * Seeds one project (link + note) so the editor, public profile and
 * dossier all render populated; cleans up afterwards.
 */
import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";

const FLAG = "feature_flag_seeker_projects";
const SEED_PASSWORD = "sebenza-dev-2026";
const OUT = "docs/screenshots/projects-wave";
const PROJECT_ID = "proj_visual-walk-demo";
let sql: ReturnType<typeof postgres> | null = null;

test.use({ viewport: { width: 1280, height: 900 } });

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function dismissCookies(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  sql = postgres(url, { max: 1 });
  await sql`
    INSERT INTO platform_settings (key, value) VALUES (${FLAG}, 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb`;
  const [me] = await sql`SELECT id FROM profiles WHERE handle = 'andile-z' LIMIT 1`;
  await sql`DELETE FROM profile_projects WHERE id = ${PROJECT_ID}`;
  await sql`
    INSERT INTO profile_projects (id, profile_id, title, url, contribution, year)
    VALUES (
      ${PROJECT_ID}, ${me!.id},
      'Township delivery tracker',
      'https://github.com/example/delivery-tracker',
      'I built the backend and the SMS notifications. Two of us worked on it over three months; the front end was my teammate.',
      2025)`;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM profile_projects WHERE id = ${PROJECT_ID}`;
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  await sql.end();
});

test("seeker: projects editor with a project + image slots", async ({ page }) => {
  await signIn(page, "andile-z@example.co.za");
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await dismissCookies(page);

  await page.goto("/en/dashboard/profile#projects");
  const heading = page.getByRole("heading", { name: /Work & projects/i });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/01-editor-with-project.png` });
});

test("seeker: adaptive empty state for a trade profession", async ({ page }) => {
  // Andile is a developer; temporarily flip the seed profession so the
  // walk captures the trade-lane copy a welder would actually see.
  await sql!`UPDATE profiles SET profession = 'Welder' WHERE handle = 'andile-z'`;
  await sql!`DELETE FROM profile_projects WHERE id = ${PROJECT_ID}`;
  try {
    await signIn(page, "andile-z@example.co.za");
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await dismissCookies(page);
    await page.goto("/en/dashboard/profile#projects");
    const empty = page.getByText(/Add photos of jobs you.ve finished/i);
    await empty.scrollIntoViewIfNeeded();
    await expect(empty).toBeVisible();
    await page.screenshot({ path: `${OUT}/02-adaptive-empty-state-trade.png` });
  } finally {
    await sql!`UPDATE profiles SET profession = 'Software Developer' WHERE handle = 'andile-z'`;
    const [me] = await sql!`SELECT id FROM profiles WHERE handle = 'andile-z' LIMIT 1`;
    await sql!`
      INSERT INTO profile_projects (id, profile_id, title, url, contribution, year)
      VALUES (${PROJECT_ID}, ${me!.id}, 'Township delivery tracker',
        'https://github.com/example/delivery-tracker',
        'I built the backend and the SMS notifications. Two of us worked on it over three months; the front end was my teammate.',
        2025)
      ON CONFLICT (id) DO NOTHING`;
  }
});

test("public profile shows the project with hostname + self-declared note", async ({
  page,
}) => {
  await page.goto("/en/p/andile-z");
  await dismissCookies(page);
  const heading = page.getByRole("heading", { name: /Work & projects/i });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  await expect(page.getByText("github.com").first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03-public-profile.png` });
});

test("the projects section is localised (isiZulu)", async ({ page }) => {
  await page.goto("/zu/p/andile-z");
  await dismissCookies(page);
  // 2026-08-20: the section shipped hardcoded in English on a localised
  // page. Assert the isiZulu heading + self-declared note render.
  const heading = page.getByRole("heading", { name: /Umsebenzi namaphrojekthi/i });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  await expect(page.getByText(/Kushiwo umuntu ngokwakhe/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-public-profile-zu.png` });
});
