/**
 * Phase 28  PWA installability assets + the floating mobile bottom nav.
 *
 * Part 1 (both projects): the manifest, service worker, offline fallback and
 * icons must be served  these are what make Android/iOS offer "install".
 *
 * Part 2 (mobile-360 only): the floating bottom bar replaces the old top tab
 * strip  4 promoted tabs + a "More" sheet holding the full role menu.
 * Screenshots land in test-results/screenshots/<project>/ like the showcase.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SEED_PASSWORD = "sebenza-dev-2026";

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.project.name}/${name}.png`,
    fullPage: false, // the bar/sheet are viewport-fixed  full-page would scroll past them
  });
}

async function signIn(page: Page, email: string, urlRe: RegExp) {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(urlRe, { timeout: 30_000 });
}

async function dismissCookieBanner(page: Page) {
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

test("PWA assets are served: manifest, service worker, offline page, icons", async ({
  request,
}) => {
  const manifestRes = await request.get("/manifest.webmanifest");
  expect(manifestRes.status()).toBe(200);
  const manifest = await manifestRes.json();
  expect(manifest.short_name).toBe("Sebenza");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  expect(
    manifest.icons.some(
      (i: { purpose?: string }) => i.purpose === "maskable",
    ),
  ).toBe(true);

  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toContain("offline.html");

  const offline = await request.get("/offline.html");
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain("offline");

  for (const path of [
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/apple-touch-icon.png",
  ]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

test("floating bottom nav: 4 tabs + More sheet with the full role menu", async ({
  page,
  viewport,
}, testInfo) => {
  test.skip(
    (viewport?.width ?? 1280) > 500,
    "mobile-only chrome  desktop keeps the sidebar",
  );

  await signIn(page, "andile-z@example.co.za", /\/dashboard(\/|$|\?)/);
  await dismissCookieBanner(page);

  // The floating bar is the only VISIBLE navigation landmark on mobile
  // (the sidebar is display:none below md).
  const bar = page
    .getByRole("navigation")
    .filter({ visible: true })
    .first();
  await expect(bar).toBeVisible();

  // 4 promoted seeker tabs (full labels are the accessible names) + More.
  for (const name of ["Overview", "Profile editor", "Vacancy invites", "Career compass"]) {
    await expect(bar.getByRole("link", { name, exact: true })).toBeVisible();
  }
  const more = bar.getByRole("button", { name: "More" });
  await expect(more).toBeVisible();
  await expect(
    bar.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await shoot(page, testInfo, "pwa-bottom-nav");

  // More opens the sheet: full remaining menu + sign-out footer.
  await more.click();
  const sheet = page.getByRole("dialog", { name: /all sections/i });
  await expect(sheet).toBeVisible();
  for (const name of ["Experience", "Qualifications", "Notifications", "Privacy & consent"]) {
    await expect(sheet.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(sheet.getByRole("button", { name: /sign out/i })).toBeVisible();
  await shoot(page, testInfo, "pwa-more-sheet");

  // Navigating from the sheet closes it and lands on the page.
  await sheet.getByRole("link", { name: "Notifications", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/notifications(\/|$|\?)/);
  await expect(sheet).toBeHidden();

  // Tab tap: client-side route + spring-pill active state via aria-current.
  await bar.getByRole("link", { name: "Career compass", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/grow(\/|$|\?)/);
  await expect(
    bar.getByRole("link", { name: "Career compass", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    bar.getByRole("link", { name: "Overview", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await shoot(page, testInfo, "pwa-bottom-nav-active");

  // Esc closes the sheet too (keyboard path).
  await more.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
