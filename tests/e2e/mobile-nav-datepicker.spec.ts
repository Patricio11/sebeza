/**
 * 2026-08-19  regression cover for two user-reported bugs:
 *
 *  1. "screen freezes when you tap the three lines" on /insights. The
 *     drawer is `fixed inset-0` inside a `backdrop-blur` header, and a
 *     backdrop-filter creates a containing block for fixed descendants
 *     so the drawer was clipped into the ~60px header strip while body
 *     scroll stayed locked. Fixed by portalling the drawer to <body>.
 *     The assertion is geometric: the drawer must fill the viewport.
 *  2. "no option to select year" on date of birth. The picker now opens
 *     straight on the year grid.
 *
 * Screenshots land in docs/screenshots/mobile-fixes/.
 */
import { test, expect } from "@playwright/test";

const OUT = "docs/screenshots/mobile-fixes";

test.describe("mobile nav drawer", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("hamburger drawer fills the viewport and closes cleanly", async ({
    page,
  }) => {
    await page.goto("/en/insights");
    await page
      .getByRole("button", { name: /accept all/i })
      .click({ timeout: 8_000 })
      .catch(() => {});

    await page.getByRole("button", { name: /open menu|menu/i }).first().click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // The regression: a trapped drawer is only as tall as the header.
    const box = await drawer.boundingBox();
    expect(box, "drawer must have a box").toBeTruthy();
    expect(box!.height).toBeGreaterThan(600);
    expect(box!.width).toBeGreaterThan(300);
    // The panel animates in over 720ms; let it settle so the screenshot
    // isn't a half-faded frame.
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/01-drawer-360.png` });

    // And the page must be usable again after closing.
    // Two controls carry this label (scrim + panel X); the scrim sits
    // behind the panel, so drive the last one  the visible X.
    await page.getByRole("button", { name: /close menu/i }).last().click();
    await expect(drawer).toBeHidden();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).not.toBe("hidden");
  });

  test("header hides on scroll down and returns on scroll up", async ({
    page,
  }) => {
    await page.goto("/en/insights");
    await page
      .getByRole("button", { name: /accept all/i })
      .click({ timeout: 8_000 })
      .catch(() => {});

    const header = page.locator("header").first();
    await expect(header).toHaveAttribute("data-hidden", "false");

    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(header).toHaveAttribute("data-hidden", "true");

    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(header).toHaveAttribute("data-hidden", "false");
  });
});

test.describe("date of birth picker", () => {
  test.use({ viewport: { width: 390, height: 820 } });

  test("opens on the year grid with a visible year control", async ({
    page,
  }) => {
    await page.goto("/en/sign-up/seeker");
    await page
      .getByRole("button", { name: /accept all/i })
      .click({ timeout: 8_000 })
      .catch(() => {});

    const field = page.getByRole("button", { name: /date of birth/i }).first();
    await field.scrollIntoViewIfNeeded();
    await field.click();

    // The fix: the year grid is the FIRST thing shown, and it says so.
    await expect(page.getByRole("button", { name: /pick a year/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "2005", exact: true })).toBeVisible();
    await page.screenshot({ path: `${OUT}/02-datepicker-year-grid.png` });

    await page.getByRole("button", { name: "2005", exact: true }).click();
    await page.screenshot({ path: `${OUT}/03-datepicker-months.png` });
  });
});
