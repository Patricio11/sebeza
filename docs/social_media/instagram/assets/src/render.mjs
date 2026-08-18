// Sebenza Instagram asset renderer.
// Same system as the Facebook kit: HTML templates -> PNGs, the chevron
// mark extracted live from public/sebenza-logo.svg. Run from the repo
// root (sebenza_v1):
//
//   node docs/social_media/instagram/assets/src/render.mjs

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.dirname(srcDir);
const repoRoot = path.resolve(outDir, "..", "..", "..", "..");

const logoSvg = readFileSync(path.join(repoRoot, "public", "sebenza-logo.svg"), "utf8");
function pathByFill(fill) {
  const m = logoSvg.match(new RegExp(`<path d="([^"]+)" fill="${fill}" transform="([^"]+)"`));
  if (!m) throw new Error(`mark path with fill ${fill} not found in sebenza-logo.svg`);
  return { d: m[1], transform: m[2] };
}
const goldLeg = pathByFill("#C88214");
const greenLeg = pathByFill("#006A3B");
const headDot = pathByFill("#C98213");

function markSvg(greenFill, goldFill) {
  return `<svg viewBox="2 18 202 180" xmlns="http://www.w3.org/2000/svg">
    <path d="${goldLeg.d}" fill="${goldFill}" transform="${goldLeg.transform}"/>
    <path d="${greenLeg.d}" fill="${greenFill}" transform="${greenLeg.transform}"/>
    <path d="${headDot.d}" fill="${goldFill}" transform="${headDot.transform}"/>
  </svg>`;
}
const MARK_DARK_ON_LIGHT = markSvg("#006b3c", "#c98214");
const MARK_LIGHT_ON_DARK = markSvg("#fbf8f0", "#c98214");

// ---- Manifest ----
const STORY = { w: 1080, h: 1920 };
const FEED = { w: 1080, h: 1350 };

const CARDS = [
  // Stories
  { template: "story-intro.html", out: "story-intro.png", ...STORY, markTone: "dark" },
  {
    template: "story.html", out: "story-free-always.png", ...STORY,
    theme: "dark", size: 132, eyebrow: "One promise we&rsquo;ll never break",
    headline: "Free for job-seekers. <em>Always.</em>",
    sub: "You will never pay a cent to be found.",
  },
  {
    template: "story.html", out: "story-trust.png", ...STORY,
    theme: "light", size: 140, eyebrow: "The honesty principle",
    headline: "<em>Trust</em> is the whole product.",
    sub: "No fake badges. No inflated numbers.",
  },
  {
    template: "story.html", out: "story-scam-warning.png", ...STORY,
    theme: "alert", size: 104, eyebrow: "Protect yourself",
    headline: "A real employer will <em>never</em> ask you to pay for a job.",
    sub: "If someone asks for money to hire you, walk away. Share this with someone job-hunting.",
  },
  {
    template: "story.html", out: "story-question.png", ...STORY,
    theme: "dark", size: 92, eyebrow: "Your turn",
    headline: "If you could change <em>one thing</em> about job-hunting in South Africa, what would it be?",
    sub: "Answer with the sticker below. We read every reply.",
  },
  // The promise carousel (cover + 5 slides)
  { template: "carousel-cover.html", out: "carousel-promise-1-cover.png", ...FEED, markTone: "dark" },
  {
    template: "carousel.html", out: "carousel-promise-2-free.png", ...FEED,
    eyebrow: "Our promise &middot; 1 of 5",
    headline: "Free for job-seekers. <em>Always.</em>",
    sub: "No fees, ever. And no paying to be seen.",
  },
  {
    template: "carousel.html", out: "carousel-promise-3-honest.png", ...FEED,
    eyebrow: "Our promise &middot; 2 of 5",
    headline: "<em>Honest.</em>",
    sub: "No fake profiles, no fake numbers, no fake badges.",
  },
  {
    template: "carousel.html", out: "carousel-promise-4-fair.png", ...FEED,
    eyebrow: "Our promise &middot; 3 of 5",
    headline: "<em>Fair.</em>",
    sub: "Matched by your skills and where you live. Never by who you know.",
  },
  {
    template: "carousel.html", out: "carousel-promise-5-private.png", ...FEED,
    eyebrow: "Our promise &middot; 4 of 5",
    headline: "<em>Private.</em>",
    sub: "Your data protected, respected, and in your control.",
  },
  {
    template: "carousel.html", out: "carousel-promise-6-proudly.png", ...FEED,
    eyebrow: "Our promise &middot; 5 of 5",
    headline: "Proudly <em>South African.</em>",
    sub: "Built here, for here. That's the promise. Follow along.",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const card of CARDS) {
  await page.setViewportSize({ width: card.w, height: card.h });
  await page.goto("file://" + path.join(srcDir, card.template).replace(/\\/g, "/"));

  const isDark = card.theme === "dark" || card.markTone === "dark";
  await page.evaluate(
    ({ card, mark }) => {
      if (card.theme) document.body.className = `theme-${card.theme}`;
      if (card.size) document.documentElement.style.setProperty("--headline-size", `${card.size}px`);
      const set = (slot, html) => {
        const el = document.querySelector(`[data-slot="${slot}"]`);
        if (el && html != null) el.innerHTML = html;
      };
      set("eyebrow", card.eyebrow);
      set("headline", card.headline);
      set("sub", card.sub ?? "");
      if (card.sticker) {
        const panel = document.querySelector(".sticker");
        if (panel) panel.style.display = "block";
      }
      document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = mark));
    },
    { card, mark: isDark ? MARK_LIGHT_ON_DARK : MARK_DARK_ON_LIGHT },
  );

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outDir, card.out),
    clip: { x: 0, y: 0, width: card.w, height: card.h },
  });
  console.log("rendered", card.out);
}

await browser.close();
console.log("done:", CARDS.length, "assets in", outDir);
