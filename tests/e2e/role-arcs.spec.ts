/**
 * Phase 12 (Task 12.3) — admin / employer / student / analytics golden
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

  // Persistent-sidebar nav (admin route-group layout): a *client-side* click
  // on the sidebar must route without unmounting the sidebar, and the active
  // item is derived from the pathname (aria-current), not a per-page prop.
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

test("employer arc: workspace + a seeker dossier render for the verified org", async ({
  page,
}) => {
  await signIn(page, "naledi.khumalo@discovery.co.za");
  await page.waitForURL(/\/employer/, { timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible();

  await page.goto("/en/employer/vacancies");
  await expect(page.locator("main")).toBeVisible();

  // The dossier is the PII-gated surface — it must render for a
  // verified org's member (reveal itself is integration-tested).
  await page.goto("/en/employer/dossier/andile-z");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Profile not found");
});

test("unverified-org employer is kept off the dossier", async ({ page }) => {
  await signIn(page, "owner@initech.example"); // seeded unverified org
  await page.waitForURL(/\/(employer|onboarding)/, { timeout: 30_000 });

  await page.goto("/en/employer/dossier/andile-z");
  // verifyOrgVerified() redirects unverified orgs to onboarding — the
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
  // Science @ Wits in the seed) — programme name proves the lane is up.
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
