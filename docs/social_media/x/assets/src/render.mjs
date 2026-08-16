// Sebenza X asset renderer (the 1500x500 profile header).
// Run from the repo root: node docs/social_media/x/assets/src/render.mjs

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
  if (!m) throw new Error(`mark path with fill ${fill} not found`);
  return { d: m[1], transform: m[2] };
}
const goldLeg = pathByFill("#C88214");
const greenLeg = pathByFill("#006A3B");
const headDot = pathByFill("#C98213");
const MARK = `<svg viewBox="2 18 202 180" xmlns="http://www.w3.org/2000/svg">
  <path d="${goldLeg.d}" fill="#c98214" transform="${goldLeg.transform}"/>
  <path d="${greenLeg.d}" fill="#fbf8f0" transform="${greenLeg.transform}"/>
  <path d="${headDot.d}" fill="#c98214" transform="${headDot.transform}"/>
</svg>`;

const CARDS = [{ template: "header-x.html", out: "header-x.png", w: 1500, h: 500 }];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const card of CARDS) {
  await page.setViewportSize({ width: card.w, height: card.h });
  await page.goto("file://" + path.join(srcDir, card.template).replace(/\\/g, "/"));
  await page.evaluate((mark) => {
    document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = mark));
  }, MARK);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, card.out), clip: { x: 0, y: 0, width: card.w, height: card.h } });
  console.log("rendered", card.out);
}
await browser.close();
console.log("done");
