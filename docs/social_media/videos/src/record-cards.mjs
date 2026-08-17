// Records the animated card videos (pure HTML/CSS choreography) to
// 1080x1920 MP4s. Run from the repo root:
//
//   node docs/social_media/videos/src/record-cards.mjs
//
// Output is silent on purpose: background sound is added in the TikTok/
// Instagram editor at post time (music licensing lives in-app).

import { chromium } from "playwright";
import { createRequire } from "node:module";
import { readFileSync, renameSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.dirname(srcDir);
const repoRoot = path.resolve(outDir, "..", "..", "..");
const require = createRequire(path.join(outDir, "package.json"));
const ffmpeg = require("ffmpeg-static");

// The chevron mark, extracted live from the shipped logo (same as the kits).
const logoSvg = readFileSync(path.join(repoRoot, "public", "sebenza-logo.svg"), "utf8");
function pathByFill(fill) {
  const m = logoSvg.match(new RegExp(`<path d="([^"]+)" fill="${fill}" transform="([^"]+)"`));
  if (!m) throw new Error(`mark path ${fill} not found`);
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

const VIDEOS = [
  { template: "card-v5-anthem.html", out: "v5-to-work.mp4", durationMs: 11_500 },
  { template: "card-v6-cvpile.html", out: "v6-cv-pile.mp4", durationMs: 19_500 },
  { template: "card-v12-free.html", out: "v12-free-means-free.mp4", durationMs: 15_000 },
  { template: "card-v4-tests.html", out: "v4-boring-work.mp4", durationMs: 17_500 },
  { template: "card-v7-scams.html", out: "v7-scam-signs.mp4", durationMs: 19_000 },
];
const ONLY = process.env.ONLY?.split(",");
const RUN = ONLY ? VIDEOS.filter((v) => ONLY.some((o) => v.out.includes(o))) : VIDEOS;

const W = 1080, H = 1920;
const browser = await chromium.launch();

for (const video of RUN) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: outDir, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  await page.goto("file://" + path.join(srcDir, video.template).replace(/\\/g, "/"));
  await page.evaluate((mark) => {
    document.querySelectorAll("[data-mark]").forEach((el) => (el.innerHTML = mark));
  }, MARK);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.body.classList.add("play")); // choreography starts here
  await page.waitForTimeout(video.durationMs + 400);
  await context.close();

  const webm = await page.video().path();
  const mp4 = path.join(outDir, video.out);
  const res = spawnSync(
    ffmpeg,
    ["-y", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", mp4],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${video.out}: ${res.stderr}`);
  rmSync(webm);
  console.log("recorded", video.out);
}

await browser.close();
console.log("done:", RUN.length, "videos in", outDir);
