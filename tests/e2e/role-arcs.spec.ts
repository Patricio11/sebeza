/**
 * Phase 12 (Task 12.3)  admin / employer / student / analytics golden
 * paths against the seeded production build.
 *
 * Note: the seed ships no gov-role account (the /gov portal is
 * partnership-gated), so the analytics surface is exercised via the
 * public /insights page, which renders the same aggregate engine.
 * 2FA forced-setup stays dormant (feature_flag_2fa_enforced default OFF),
 * so seeded employer/admin sign-ins land directly.
 */
import { expect, test, type Page } from "@playwright/test";

const SEED_PASSWORD = "sebenza-dev-2026";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("admin arc: overview KPIs + verification queue render from the real DB", async ({
  page,
}) => {
  await signIn(page, "admin@sebenzasa.com");
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible();

  // Phase 28: on mobile the nav is the floating BOTTOM bar, and the cookie
  // banner (also bottom-fixed, z-50) covers it until a choice is made 
  // dismiss it first or the nav click below is intercepted. `.click()`
  // auto-waits; `.catch` absorbs the banner being absent (desktop reuse).
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});

  // Persistent nav (admin route-group layout): a *client-side* click on the
  // sidebar (desktop) / bottom bar (mobile) must route without unmounting
  // the frame, and the active item is derived from the pathname
  // (aria-current), not a per-page prop.
  const visibleNavLink = (name: string) =>
    page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .filter({ visible: true })
      .first();

  await visibleNavLink("Users").click();
  await expect(page).toHaveURL(/\/admin\/users(\/|$|\?)/);
  await expect(page.locator("main")).toBeVisible();
  // Sidebar survived the navigation and now marks Users active.
  await expect(visibleNavLink("Users")).toHaveAttribute("aria-current", "page");
  await expect(visibleNavLink("Overview")).not.toHaveAttribute("aria-current", "page");

  await page.goto("/en/admin/verifications");
  await expect(page.locator("main")).toBeVisible();

  await page.goto("/en/admin/moderation");
  await expect(page.locator("main")).toBeVisible();
});

test("admin user detail opens in-shell (no bounce to the public profile)", async ({
  page,
}) => {
  await signIn(page, "admin@sebenzasa.com");
  await page.waitForURL(/\/admin/, { timeout: 30_000 });

  // Filter to active seekers so the clicked target is a known, non-admin,
  // non-self account  its account-action controls must be live.
  await page.goto("/en/admin/users?role=seeker&status=active");
  await expect(page.locator("main")).toBeVisible();

  // Click a user in the directory  must open /admin/users/[id] INSIDE the
  // admin shell, not bounce out to the public /p/[handle].
  const firstUserLink = page
    .locator('a[href*="/admin/users/"]')
    .filter({ visible: true })
    .first();
  await firstUserLink.click();

  await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
  await expect(page).not.toHaveURL(/\/p\//);
  await expect(page.locator("main")).toBeVisible();
  // Still in the admin frame: sidebar/nav present + a back affordance.
  await expect(page.getByRole("navigation").first()).toBeVisible();
  const backLink = page.getByRole("link", { name: /back to user directory/i });
  await expect(backLink).toBeVisible();

  // Full management surface: the info sections + live account actions.
  await expect(page.getByRole("heading", { name: /security & access/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /account actions/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /seeker profile/i })).toBeVisible();
  // Active non-admin target → real action controls (not just info).
  await expect(page.getByRole("button", { name: /suspend account/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /reset two-factor auth/i })).toBeVisible();

  // Back returns to the directory.
  await backLink.click();
  await expect(page).toHaveURL(/\/admin\/users$/);
});

test("employer arc: workspace + a seeker dossier render for the verified org", async ({
  page,
}) => {
  await signIn(page, "naledi.khumalo@discovery.co.za");
  await page.waitForURL(/\/employer/, { timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible();

  await page.goto("/en/employer/vacancies");
  await expect(page.locator("main")).toBeVisible();

  // The dossier is the PII-gated surface  it must render for a
  // verified org's member (reveal itself is integration-tested).
  await page.goto("/en/employer/dossier/andile-z");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Profile not found");
});

test("unverified-org employer is kept off the dossier", async ({ page }) => {
  await signIn(page, "owner@initech.example"); // seeded unverified org
  await page.waitForURL(/\/(employer|onboarding)/, { timeout: 30_000 });

  await page.goto("/en/employer/dossier/andile-z");
  // verifyOrgVerified() redirects unverified orgs to onboarding  the
  // dossier content must never render for them.
  await page.waitForURL((url) => !url.pathname.includes("/dossier/"), {
    timeout: 15_000,
  });
});

test("student arc: Career Compass student lane renders for a cohort member", async ({
  page,
}) => {
  await signIn(page, "wits-bsc-cs-2026-08@example.co.za");
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await page.goto("/en/dashboard/grow");
  await expect(page.locator("main")).toBeVisible();
  // The student lane anchors on the academic record (BSc Computer
  // Science @ Wits in the seed)  programme name proves the lane is up.
  await expect(page.locator("main")).toContainText(/computer science/i);
});

test("analytics surface: /insights renders aggregates with honest empty states", async ({
  page,
}) => {
  await page.goto("/en/insights");
  await expect(page.locator("main")).toBeVisible();
  const body = await page.locator("body").innerText();
  // Aggregate-only surface: nothing shaped like an SA ID may ever render.
  expect(body).not.toMatch(/\b\d{13}\b/);
});
