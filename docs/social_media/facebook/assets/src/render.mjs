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
const repoRoot = path.resolve(outDir, "..", "..", "..", "..");

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
  {
    template: "product.html", out: "post-03-one-liner.png", w: 1080, h: 1350,
    eyebrow: "What Sebenza is",
    headline: "Search a skill and a city. See <em>real people</em>.",
    sub: "Not a pile of CVs. A place where talent is findable.",
    shot: "shots/search-chef-row.png",
    caption: "Live search on sebenzasa.com &middot; chef, Cape Town",
  },
  {
    template: "quote.html", out: "post-07-for-everyone.png", w: 1080, h: 1350,
    theme: "light", size: 118, eyebrow: "For everyone, fairly",
    headline: "Talent is talent. We help it get <em>found</em>.",
    sub: "Matched by your skills and where you live. Full stop. Citizens first, nobody here legally left out.",
  },
  {
    template: "montage.html", out: "post-08-why-we-started.png", w: 1080, h: 1350,
    size: 84, markTone: "light", eyebrow: "Why we started",
    headline: "Months of nights and weekends, so talent stops being <em>invisible</em>.",
    sub: "Talented people kept missing out, not for lack of skill, but because nobody could find them. Building is what we can do.",
    shots: ["shots/bts-search.png", "shots/bts-compass.png", "shots/bts-insights.png"],
    caption: "The real product on the seeded showcase register",
  },
  {
    template: "quote.html", out: "post-11-hard-parts.png", w: 1080, h: 1350,
    theme: "dark", size: 92, eyebrow: "Behind the build",
    headline: "Some nights it&rsquo;s magic. Some nights it&rsquo;s a bug that won&rsquo;t <em>die</em>.",
    sub: "One person getting hired because of this makes every late night worth it. If you&rsquo;re building something hard: keep going.",
  },
  {
    template: "product.html", out: "post-12-what-to-learn.png", w: 1080, h: 1350,
    size: 82, eyebrow: "A feature we love",
    headline: "The part that tells you <em>what to learn next</em>.",
    sub: "What employers near you are searching for, minus the skills already on your profile. Ranked by the size of the gap.",
    shot: "shots/compass-what-to-learn.png",
    caption: "Career compass &middot; in every seeker&rsquo;s dashboard",
  },
  {
    template: "product.html", out: "post-14-available-now.png", w: 1080, h: 1350,
    size: 92, eyebrow: "Available now",
    headline: "Live, honest, <em>current</em>.",
    sub: "People confirm they are still looking. The system knows when that is fresh or getting old, and stale statuses fall to the bottom.",
    shot: "shots/search-status-fresh.png",
    caption: "Status and freshness, on every profile in search",
  },
  {
    template: "product.html", out: "post-15-for-employers.png", w: 1080, h: 1350,
    size: 82, eyebrow: "For employers",
    headline: "Skilled people <em>near you</em>, in minutes.",
    sub: "Experience already laid out. No agency fees. Not a flood of random applications.",
    shot: "shots/search-chef-employer.png",
    caption: "Search on sebenzasa.com &middot; chef, Western Cape",
  },
  {
    template: "product.html", out: "post-16-bigger-picture.png", w: 1080, h: 1350,
    size: 82, eyebrow: "The bigger picture",
    headline: "A live map of the country&rsquo;s <em>skills gaps</em>.",
    sub: "Every search quietly shows which skills employers want but cannot find, and where. Aggregate only, never one person.",
    shot: "shots/insights-skills-gap.png",
    caption: "Employment insights &middot; public, anonymised",
  },
  {
    template: "quote.html", out: "post-17-the-dream.png", w: 1080, h: 1350,
    theme: "dark", size: 86, eyebrow: "The dream",
    headline: "A South Africa where any skilled person can be <em>found</em>, wherever they live.",
    sub: "We&rsquo;re not there yet. We&rsquo;re at the start. Every big thing starts with one line of code and one person who won&rsquo;t give up.",
  },
  {
    template: "product.html", out: "post-18-students.png", w: 1080, h: 1350,
    size: 82, eyebrow: "Students &amp; graduates",
    headline: "Bridge your degree to the <em>market</em>.",
    sub: "See what employers in your area really want before you graduate. Study smart, not just hard.",
    shot: "shots/compass-student-lane.png",
    caption: "Career compass, student mode",
  },
  {
    template: "list.html", out: "post-19-cv-tip.png", w: 1080, h: 1350,
    theme: "light", marker: "number", size: 88, eyebrow: "CV tip",
    headline: "Skills near the top. Be <em>specific</em>.",
    items: [
      { lead: "Put your skills first.", body: "Above the long paragraphs." },
      { lead: "Name them.", body: "Not &ldquo;hard worker.&rdquo; Say &ldquo;pastry, menu planning, kitchen management.&rdquo;" },
      { lead: "Employers search for skills,", body: "not adjectives." },
    ],
    sub: "Save this for when you update yours.",
  },
  {
    template: "list.html", out: "post-20-interview-tip.png", w: 1080, h: 1350,
    theme: "dark", marker: "number", size: 88, eyebrow: "Interview tip",
    headline: "Prepare <em>one real story</em>.",
    items: [
      { lead: "Something you actually did.", body: "Short and honest." },
      { lead: "What happened, and the result.", body: "One or two lines." },
      { lead: "Say it out loud", body: "until it feels natural." },
    ],
    sub: "For &ldquo;tell me about yourself.&rdquo; Confidence comes from preparation, not luck.",
  },
  {
    template: "list.html", out: "post-21-in-demand.png", w: 1080, h: 1350,
    theme: "light", marker: "dot", size: 84, eyebrow: "Skills in demand",
    headline: "What SA employers are <em>hungry</em> for.",
    items: [
      { lead: "Trades.", body: "Electricians, welders, plumbers." },
      { lead: "Tech.", body: "Developers, IT support." },
      { lead: "Healthcare." },
      { lead: "Skilled hospitality." },
    ],
    sub: "The gap between what people study and what employers need is real. Closing it starts with knowing it exists.",
  },
  {
    template: "list.html", out: "post-22-free-learning.png", w: 1080, h: 1350,
    theme: "light", marker: "dot", size: 78, eyebrow: "Free learning matters",
    headline: "You don&rsquo;t need an expensive course to become more <em>employable</em>.",
    items: [
      { lead: "SETA learnerships" },
      { lead: "TVET colleges" },
      { lead: "INDLELA", body: "trade testing" },
      { lead: "Free online courses" },
    ],
    sub: "Often at little or no cost. The trick is knowing which skill to learn for the jobs near you.",
  },
  {
    template: "quote.html", out: "post-02-who.png", w: 1080, h: 1350,
    theme: "light", size: 92, eyebrow: "Who's behind this",
    headline: "A small South African company with one belief: this country's talent deserves to be <em>seen</em>.",
    sub: "Built quietly, line by line, on nights and weekends. No hype. No shortcuts.",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();

// ONLY=post-07-for-everyone.png node render.mjs  renders just those outputs.
const ONLY = process.env.ONLY?.split(",").map((o) => o.trim());
for (const card of CARDS) {
  if (ONLY && !ONLY.includes(card.out)) continue;
  await page.setViewportSize({ width: card.w, height: card.h });
  await page.goto("file://" + path.join(srcDir, card.template).replace(/\\/g, "/"));

  const isDarkQuote = card.theme === "dark";
  const markTone = card.markTone === "dark" || isDarkQuote ? "dark" : "light";
  await page.evaluate(
    ({ card, mark }) => {
      if (card.theme || card.marker) {
        document.body.className = [
          card.theme ? `theme-${card.theme}` : "",
          card.marker ? `marker-${card.marker}` : "",
        ].join(" ").trim();
      }
      if (card.size) document.documentElement.style.setProperty("--headline-size", `${card.size}px`);
      if (card.itemSize) document.documentElement.style.setProperty("--item-size", `${card.itemSize}px`);
      // list.html: items are { lead, body } pairs; lead is bold, body is soft.
      const list = document.querySelector('[data-slot="items"]');
      if (list && card.items) {
        list.innerHTML = card.items
          .map(
            (it, i) =>
              `<li class="item"><span class="num">${i + 1}</span><p><strong>${it.lead}</strong>${
                it.body ? ` <span>${it.body}</span>` : ""
              }</p></li>`,
          )
          .join("");
      }
      const set = (slot, html) => {
        const el = document.querySelector(`[data-slot="${slot}"]`);
        if (el && html != null) el.innerHTML = html;
      };
      set("eyebrow", card.eyebrow);
      set("headline", card.headline);
      set("sub", card.sub ?? "");
      set("caption", card.caption ?? "");
      if (card.shot) {
        const img = document.querySelector("[data-shot]");
        if (img) img.setAttribute("src", card.shot);
      }
      (card.shots ?? []).forEach((src, i) => {
        const img = document.querySelector(`[data-shot-${i + 1}]`);
        if (img) img.setAttribute("src", src);
      });
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
