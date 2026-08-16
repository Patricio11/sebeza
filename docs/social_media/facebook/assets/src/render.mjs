// Sebenza social asset renderer.
// Renders the HTML templates in this directory to PNGs one level up,
// using the repo's Playwright. Run from the repo root (sebenza_v1):
//
//   node docs/social_media/assets/src/render.mjs
//
// The chevron person-mark is extracted live from public/sebenza-logo.svg
// (gold leg #C88214, green leg #006A3B, head dot #C98213) so the social
// mark can never drift from the shipped product mark.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.dirname(srcDir);
const repoRoot = path.resolve(outDir, "..", "..", "..");

// ---- Extract the mark's three paths from the shipped logo ----
const logoSvg = readFileSync(path.join(repoRoot, "public", "sebenza-logo.svg"), "utf8");
function pathByFill(fill) {
  const m = logoSvg.match(new RegExp(`<path d="([^"]+)" fill="${fill}" transform="([^"]+)"`));
  if (!m) throw new Error(`mark path with fill ${fill} not found in sebenza-logo.svg`);
  return { d: m[1], transform: m[2] };
}
const goldLeg = pathByFill("#C88214");
const greenLeg = pathByFill("#006A3B");
const headDot = pathByFill("#C98213");

// greenFill: the green leg colour (cream on dark surfaces, like the light logo).
function markSvg(greenFill, goldFill) {
  return `<svg viewBox="2 18 202 180" xmlns="http://www.w3.org/2000/svg">
    <path d="${goldLeg.d}" fill="${goldFill}" transform="${goldLeg.transform}"/>
    <path d="${greenLeg.d}" fill="${greenFill}" transform="${greenLeg.transform}"/>
    <path d="${headDot.d}" fill="${goldFill}" transform="${headDot.transform}"/>
  </svg>`;
}
const MARK_DARK_ON_LIGHT = markSvg("#006b3c", "#c98214"); // for cream cards
const MARK_LIGHT_ON_DARK = markSvg("#fbf8f0", "#c98214"); // for deep-green cards

// ---- Manifest ----
// theme: light | dark | alert (quote.html only). size: headline px.
const CARDS = [
  { template: "profile.html", out: "profile-picture.png", w: 1080, h: 1080 },
  { template: "cover.html", out: "cover-photo.png", w: 1640, h: 624, markTone: "dark" },
  { template: "intro.html", out: "post-01-intro.png", w: 1080, h: 1350, markTone: "dark" },
  {
    template: "quote.html", out: "post-04-talent-invisible.png", w: 1080, h: 1350,
    theme: "light", size: 96, eyebrow: "The reality",
    headline: "The problem was never a shortage of talent. It&rsquo;s that talent is <em>invisible</em>.",
  },
  {
    template: "quote.html", out: "post-05-dignity.png", w: 1080, h: 1350,
    theme: "light", size: 116, eyebrow: "Dignity",
    headline: "Being <em>seen</em> matters. Everyone deserves that.",
  },
  {
    template: "quote.html", out: "post-06-free-always.png", w: 1080, h: 1350,
    theme: "dark", size: 128, eyebrow: "One promise we&rsquo;ll never break",
    headline: "Free for job-seekers. <em>Always.</em>",
    sub: "You will never pay a cent to be found.",
  },
  {
    template: "quote.html", out: "post-09-cheap-phone.png", w: 1080, h: 1350,
    theme: "light", size: 96, eyebrow: "A rule we refused to break",
    headline: "It has to work on a cheap phone, on <em>slow data</em>.",
    sub: "Fast and fair beats flashy. Every time.",
  },
  {
    template: "quote.html", out: "post-10-trust.png", w: 1080, h: 1350,
    theme: "dark", size: 138, eyebrow: "The honesty principle",
    headline: "<em>Trust</em> is the whole product.",
    sub: "No fake badges. No inflated numbers. If it isn&rsquo;t verified, we say so.",
  },
  {
    template: "quote.html", out: "post-13-the-name.png", w: 1080, h: 1350,
    theme: "light", size: 148, eyebrow: "Why the name",
    headline: "Sebenza. <em>&ldquo;to work.&rdquo;</em>",
    sub: "A South African word for a South African problem. One word, understood across the country.",
  },
  {
    template: "quote.html", out: "post-23-scam-warning.png", w: 1080, h: 1350,
    theme: "alert", size: 98, eyebrow: "Protect yourself",
    headline: "A real employer will <em>never</em> ask you to pay for a job.",
    sub: "No &ldquo;training fees.&rdquo; No &ldquo;registration deposits.&rdquo; If someone asks for money to hire you, walk away.",
  },
  {
    template: "quote.html", out: "post-25-youth.png", w: 1080, h: 1350,
    theme: "light", size: 96, eyebrow: "Who we build for",
    headline: "This generation has the talent. It needs a fair chance to be <em>seen</em>.",
  },
  {
    template: "quote.html", out: "post-26-question.png", w: 1080, h: 1350,
    theme: "dark", size: 88, eyebrow: "Your turn",
    headline: "If you could change <em>one thing</em> about job-hunting in South Africa, what would it be?",
    sub: "Tell us in the comments. We read every answer.",
  },
  { template: "checklist.html", out: "post-30-promise.png", w: 1080, h: 1350 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const card of CARDS) {
  await page.setViewportSize({ width: card.w, height: card.h });
  await page.goto("file://" + path.join(srcDir, card.template).replace(/\\/g, "/"));

  const isDarkQuote = card.theme === "dark";
  const markTone = card.markTone === "dark" || isDarkQuote ? "dark" : "light";
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
      document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = mark));
    },
    { card, mark: markTone === "dark" ? MARK_LIGHT_ON_DARK : MARK_DARK_ON_LIGHT },
  );

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const outPath = path.join(outDir, card.out);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: card.w, height: card.h } });
  console.log("rendered", card.out);
}

await browser.close();
console.log("done:", CARDS.length, "assets in", outDir);
