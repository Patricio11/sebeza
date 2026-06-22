/**
 * Phase 12 (Task 12.3)  public golden path:
 * landing → search roster → public dossier, at both viewports.
 *
 * Asserts the Redaction Rule from the BROWSER side: the rendered dossier
 * HTML must never contain a seed email address or anything shaped like a
 * 13-digit SA ID. Also enforces the No-Flash floor: zero console errors
 * and no horizontal overflow at 360px.
 */
import { expect, test, type Page } from "@playwright/test";

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const loc = msg.location();
      errors.push(`${msg.text()} [at ${loc.url || "unknown"}]`);
    }
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "?";
    // Cancelled RSC prefetches (Link hover/viewport prefetch aborted by a
    // navigation) are normal App Router behaviour, not failures.
    if (reason === "net::ERR_ABORTED") return;
    errors.push(`request failed: ${req.url()} (${reason})`);
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

test("landing renders clean", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/en");
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("search → dossier: roster works and the dossier leaks no PII", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto("/en/search");
  await expect(page.locator("main")).toBeVisible();

  // The seeded roster must yield at least one public profile link.
  const profileLink = page.locator('a[href*="/p/"]').first();
  await expect(profileLink).toBeVisible();
  await profileLink.click();
  await page.waitForURL(/\/p\//);

  const body = await page.locator("body").innerText();
  // Seed seeker emails all live on this domain; none may render publicly.
  expect(body).not.toContain("@example.co.za");
  // Nothing shaped like a 13-digit SA ID number.
  expect(body).not.toMatch(/\b\d{13}\b/);

  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("anonymous visitors are bounced off the seeker dashboard", async ({
  page,
}) => {
  await page.goto("/en/dashboard");
  // Layer-1 proxy bounce: anywhere but the dashboard is acceptable;
  // the dashboard itself rendering for an anonymous visitor is not.
  await page.waitForURL((url) => !url.pathname.endsWith("/dashboard"));
});
