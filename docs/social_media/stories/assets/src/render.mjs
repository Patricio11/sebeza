// Sebenza STORIES renderer (Instagram + Facebook stories, 1080x1920).
// Same system as the Facebook/Instagram kits: HTML template -> PNGs,
// the chevron mark extracted live from public/sebenza-logo.svg.
// Run from the repo root (sebenza_v1):
//
//   node docs/social_media/stories/assets/src/render.mjs

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

// ---- Manifest ------------------------------------------------------------
// Every card is 1080x1920. `theme`: light | dark | alert. `layout`:
// headline (default) | figure | list | quote | steps. `sticker: true`
// shows the dashed panel the founder covers with an IG/FB sticker.
// House rules: no em-dashes anywhere; "South Africa" never translated.

const CARDS = [
  // ---- Identity + promise ----
  {
    out: "story-towork.png", theme: "dark", size: 148,
    eyebrow: "Sebenza &middot; isiZulu &middot; isiXhosa",
    headline: "To <em>work.</em>",
    sub: "One word, understood across the country.",
  },
  {
    out: "story-dignity.png", theme: "light", layout: "quote",
    eyebrow: "Why we build",
    quote: "Looking for work is work. It deserves <em>dignity</em>.",
    source: "The Sebenza promise",
  },
  {
    out: "story-r0.png", theme: "dark", layout: "figure",
    eyebrow: "What job-seekers pay",
    figure: "R0",
    headline: "Not now. <em>Not ever.</em>",
    sub: "Charging people who are looking for work is not a business model.",
  },

  // ---- The flip ----
  {
    out: "story-cv-pile.png", theme: "dark", size: 104,
    eyebrow: "The old way",
    headline: "Your CV is number <em>347</em> in a pile nobody opens.",
    sub: "So we flipped the whole thing.",
  },
  {
    out: "story-get-found.png", theme: "light", size: 132,
    eyebrow: "The Sebenza way",
    headline: "Stop applying. <em>Get found.</em>",
    sub: "Employers search by skill and place. Your profile answers.",
  },
  {
    out: "story-decline-free.png", theme: "light", size: 116,
    eyebrow: "Your call, always",
    headline: "Saying <em>no</em> costs you nothing.",
    sub: "Decline any invitation. It never touches how you show up in search.",
  },

  // ---- The loop (the new machinery, on one card) ----
  {
    out: "story-the-loop.png", theme: "dark", layout: "steps", size: 84,
    eyebrow: "The whole loop, on the record",
    headline: "From <em>found</em> to <em>hired</em>.",
    items: [
      { n: "&#9656;", t: "An employer finds your skills" },
      { n: "&#9656;", t: "You accept, on your terms" },
      { n: "&#9656;", t: "The interview: date, place, one card" },
      { n: "&#9656;", t: "Hired, confirmed, counted", won: true },
    ],
  },
  {
    out: "story-interview.png", theme: "light", size: 100,
    eyebrow: "New on Sebenza",
    headline: "The interview lands on <em>the record</em>.",
    sub: "Date, time, place and instructions in one card. Both sides see the same facts. Add to calendar, one tap.",
  },

  // ---- Honesty ----
  {
    out: "story-verified.png", theme: "light", size: 100,
    eyebrow: "The honesty principle",
    headline: "If we didn&rsquo;t check it, it says <em>unverified</em>.",
    sub: "In a world of fake badges, we do the opposite.",
  },
  {
    out: "story-hire-local.png", theme: "light", size: 108,
    eyebrow: "Honest by design",
    headline: "Hire local, <em>honestly</em>.",
    sub: "One tap groups SA citizens first. Nobody is removed from the results.",
  },
  {
    out: "story-privacy.png", theme: "dark", size: 108,
    eyebrow: "POPIA, by design",
    headline: "Your number is <em>yours</em>.",
    sub: "Employers see your contact only when consent says so. Every look is on the audit log.",
  },

  // ---- Built for the real South Africa ----
  {
    out: "story-3g.png", theme: "dark", size: 108,
    eyebrow: "Built for the real South Africa",
    headline: "Made for a R1500 phone on <em>3G</em>. On purpose.",
    sub: "The people who need this most are on entry-level phones and expensive data.",
  },
  {
    out: "story-languages.png", theme: "light", layout: "list", size: 92,
    eyebrow: "Your profile, your language",
    headline: "Four languages. <em>One register.</em>",
    items: [
      { n: "01", t: "English" },
      { n: "02", t: "isiZulu" },
      { n: "03", t: "isiXhosa" },
      { n: "04", t: "Afrikaans" },
    ],
  },
  {
    out: "story-skills-map.png", theme: "dark", size: 104,
    eyebrow: "The bigger picture",
    headline: "South Africa&rsquo;s skills gaps, <em>live</em>.",
    sub: "Every search quietly maps what the country needs. Not last year&rsquo;s survey.",
  },

  // ---- Protect the community ----
  {
    out: "story-scam-3signs.png", theme: "alert", layout: "list", size: 88,
    eyebrow: "Protect yourself",
    headline: "3 signs a job offer is a <em>scam</em>",
    items: [
      { n: "01", t: "They ask for a &ldquo;registration fee&rdquo;" },
      { n: "02", t: "Payment before training starts" },
      { n: "03", t: "Pressure to pay TODAY", small: "A real employer never asks you to pay. Share this." },
    ],
  },
  {
    out: "story-share.png", theme: "light", size: 112,
    eyebrow: "Pass it on",
    headline: "Know someone <em>looking</em>? Send them this.",
    sub: "A profile takes minutes. It&rsquo;s free. It&rsquo;s theirs.",
  },

  // ---- Employer-facing ----
  {
    out: "story-employers.png", theme: "dark", size: 100,
    eyebrow: "For employers",
    headline: "Search talent like you search <em>anything else</em>.",
    sub: "Skill + place, on a verified national register. The pipeline runs itself.",
  },

  // ---- Sticker stories (interactive) ----
  {
    out: "story-poll-hunting.png", theme: "dark", size: 116, sticker: true,
    eyebrow: "Quick one",
    headline: "Job hunting <em>right now</em>?",
    sub: "Tap the poll. No wrong answers.",
  },
  {
    out: "story-ask-anything.png", theme: "light", size: 116, sticker: true,
    eyebrow: "Open floor",
    headline: "Ask us <em>anything</em> about Sebenza.",
    sub: "Fees, privacy, how matching works. We answer straight.",
  },
  {
    out: "story-countdown.png", theme: "dark", size: 108, sticker: true,
    eyebrow: "Keep an eye out",
    headline: "Something new lands <em>this week</em>.",
    sub: "Built, tested, and real. Set the countdown.",
  },
];

const W = 1080, H = 1920;
const browser = await chromium.launch();
const page = await browser.newPage();

for (const card of CARDS) {
  await page.setViewportSize({ width: W, height: H });
  await page.goto("file://" + path.join(srcDir, "story.html").replace(/\\/g, "/"));

  const isDark = card.theme === "dark";
  await page.evaluate(
    ({ card, mark }) => {
      const cls = [`theme-${card.theme ?? "light"}`];
      if (card.layout) cls.push(`layout-${card.layout}`);
      document.body.className = cls.join(" ");
      if (card.size) document.documentElement.style.setProperty("--headline-size", `${card.size}px`);
      const set = (slot, html) => {
        const el = document.querySelector(`[data-slot="${slot}"]`);
        if (el && html != null) el.innerHTML = html;
      };
      set("eyebrow", card.eyebrow);
      set("headline", card.headline ?? "");
      set("sub", card.sub ?? "");
      set("figure", card.figure ?? "");
      set("quote", card.quote ?? "");
      set("source", card.source ?? "");
      if (card.items) {
        const wrap = document.querySelector("[data-items]");
        wrap.innerHTML = card.items
          .map(
            (it) =>
              `<div class="row${it.won ? " won" : ""}"><span class="n">${it.n}</span><span class="t">${it.t}${it.small ? `<small>${it.small}</small>` : ""}</span></div>`,
          )
          .join("");
      }
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
    clip: { x: 0, y: 0, width: W, height: H },
  });
  console.log("rendered", card.out);
}

await browser.close();
console.log("done:", CARDS.length, "stories in", outDir);
