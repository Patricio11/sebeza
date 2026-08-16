// Sebenza TikTok asset renderer (video covers). Same system as the other
// platform kits. Run from the repo root (sebenza_v1):
//
//   node docs/social_media/tiktok/assets/src/render.mjs

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
const MARK_LIGHT_ON_DARK = `<svg viewBox="2 18 202 180" xmlns="http://www.w3.org/2000/svg">
  <path d="${goldLeg.d}" fill="#c98214" transform="${goldLeg.transform}"/>
  <path d="${greenLeg.d}" fill="#fbf8f0" transform="${greenLeg.transform}"/>
  <path d="${headDot.d}" fill="#c98214" transform="${headDot.transform}"/>
</svg>`;

const COVER = { template: "video-cover.html", w: 1080, h: 1920 };
const CARDS = [
  { ...COVER, out: "cover-v1-search.png", eyebrow: "The product", title: "Watch talent become <em>findable</em>." },
  { ...COVER, out: "cover-v2-learn.png", eyebrow: "The product", title: "It tells you what to <em>learn next</em>." },
  { ...COVER, out: "cover-v3-phone.png", eyebrow: "How we build", title: "Built for a <em>R1500 phone</em>. On purpose." },
  { ...COVER, out: "cover-v4-tests.png", eyebrow: "The build", title: "The <em>boring work</em> that keeps your data safe." },
  { ...COVER, out: "cover-v5-towork.png", eyebrow: "isiZulu &middot; isiXhosa", title: "Sebenza. <em>&ldquo;to work.&rdquo;</em>" },
  { ...COVER, out: "cover-v8-verified.png", eyebrow: "The honesty principle", title: "What <em>verified</em> actually means." },
  { ...COVER, out: "cover-v9-languages.png", eyebrow: "The product", title: "One profile. <em>Four languages</em>." },
  { ...COVER, out: "cover-v10-map.png", eyebrow: "The bigger picture", title: "South Africa&rsquo;s <em>skills map</em>, live." },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const card of CARDS) {
  await page.setViewportSize({ width: card.w, height: card.h });
  await page.goto("file://" + path.join(srcDir, card.template).replace(/\\/g, "/"));
  await page.evaluate(
    ({ card, mark }) => {
      const set = (slot, html) => {
        const el = document.querySelector(`[data-slot="${slot}"]`);
        if (el && html != null) el.innerHTML = html;
      };
      set("eyebrow", card.eyebrow);
      set("title", card.title);
      document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = mark));
    },
    { card, mark: MARK_LIGHT_ON_DARK },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, card.out), clip: { x: 0, y: 0, width: card.w, height: card.h } });
  console.log("rendered", card.out);
}

await browser.close();
console.log("done:", CARDS.length, "assets in", outDir);
