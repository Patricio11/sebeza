/**
 * 2026-08-20  product screenshots for the social kit.
 *
 * Captures the REAL product against the SEEDED harness (fictional
 * showcase profiles), never live data: the standing rule is no real PII
 * in any published graphic. Output feeds the branded card templates in
 * docs/social_media/facebook/assets/src/.
 *
 * Run on demand:
 *   npx playwright test tests/e2e/social-capture.spec.ts --project=desktop
 */
import { test } from "@playwright/test";

const OUT = "docs/social_media/facebook/assets/src/shots";

test("search results for chef in Cape Town (phone)", async ({ browser }) => {
  // A modern phone screen, so the frame in the card looks native.
  const context = await browser.newContext({
    viewport: { width: 430, height: 880 },
    deviceScaleFactor: 3, // retina: the card scales it down, so it stays crisp
  });
  const page = await context.newPage();

  // The heading resolves the city from its SLUG, so "cape-town" both
  // filters the results and prints "Cape Town" in the headline.
  await page.goto("/en/search?q=chef&city=cape-town");
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  // Scroll past the site header so the RESULTS fill the frame: the point
  // of the post is "see real people", not our chrome.
  // (a) the scrolling list, for a phone-frame treatment.
  await page.evaluate(() => window.scrollTo(0, 430));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/search-chef-list.png` });

  // (b) ONE result row as an element shot: clean edges, no clipped text,
  //     and legible at feed-thumbnail size.
  // Do NOT restyle the row. Its spacing on a real phone is the spacing we
  // want in the graphic, so instead of an element screenshot (which crops
  // hard to the element box and leaves the content flush against the
  // edges) we clip the real page to the row's box plus a small, even
  // margin of the page background around it.
  const row = page
    .locator("li")
    .filter({ hasText: "Thandeka M." })
    .first();
  // Two capture-only tweaks, neither of which touches the row itself:
  // un-stick the pinned search bar (it floats OVER the first result and
  // would slice the name off the top of the clip), and drop the list
  // divider, which reads as a stray line once the row is lifted out.
  await page.addStyleTag({
    content: `
      [class~="sticky"], [class~="fixed"] { position: static !important; }
      li hr { display: none !important; }
    `,
  });
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const box = await row.boundingBox();
  if (!box) throw new Error("result row not found on the page");
  const MARGIN = 12;
  await page.screenshot({
    path: `${OUT}/search-chef-row.png`,
    clip: {
      x: Math.max(0, box.x - MARGIN),
      y: Math.max(0, box.y - MARGIN),
      width: box.width + MARGIN * 2,
      height: box.height + MARGIN * 2,
    },
  });
  await context.close();
});
