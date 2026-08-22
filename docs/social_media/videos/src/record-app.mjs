// Records the product-demo videos (V1 search, V9 languages) by driving the
// REAL app at mobile size against the E2E test server (seeded showcase
// data only, never the live register). Overlay hooks are injected into the
// page live, in the brand, so no post-production is needed.
//
//   1. node docs/social_media/videos/src/serve-app.mjs   (wait for :3100)
//   2. node docs/social_media/videos/src/record-app.mjs
//
// Recording notes learned the hard way:
// - Playwright records at CSS-pixel size: recordVideo.size MUST equal the
//   viewport or the frame letterboxes into a corner. We record at 756x1344
//   (largest exact-9:16 width still under Tailwind's md=768 breakpoint, so
//   the layout stays mobile) and upscale to 1080x1920 in ffmpeg.
// - The page-load lead is trimmed with -ss so the hook is frame one.
// - The cookie banner is dismissed while the hook overlay covers the page.

import { chromium } from "playwright";
import { createRequire } from "node:module";
import { rmSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.dirname(srcDir);
const require = createRequire(path.join(outDir, "package.json"));
const ffmpeg = require("ffmpeg-static");

const BASE = process.env.SEBENZA_VIDEO_BASE_URL ?? "http://localhost:3100";

// Stage state in the DISPOSABLE test database (the only DB serve-app.mjs
// will ever run against). Used by the interview videos so retakes are
// idempotent: the one-active index would otherwise refuse the second take.
function stageSql(q) {
  execSync(
    'docker exec sebenza-test-pg psql -U postgres -d sebenza_test -c "' + q.replace(/"/g, '\\"') + '"',
    { stdio: "ignore" },
  );
}
const VIEW = { width: 756, height: 1344 }; // exact 9:16, still mobile layout

// ---- Overlay system (injected per page; uses the app's own brand fonts) ----
const OVERLAY_CSS = `
  #sz-hook { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; background: #003d1f;
    color: #fbf8f0; font-family: var(--font-display, Georgia), Georgia, serif; font-size: 64px;
    line-height: 1.16; padding: 0 62px; letter-spacing: -0.01em; font-weight: 560;
    transition: opacity 0.6s ease; }
  #sz-hook em, #sz-note em { font-style: italic; color: #f5a623; }
  #sz-hook .sz-stripe { position: absolute; bottom: 0; left: 0; right: 0; height: 14px; display: flex; }
  .sz-stripe i { display: block; } .sz-stripe .g { flex: 3; background: #0a8c50; }
  .sz-stripe .a { flex: 2; background: #c98214; } .sz-stripe .r { flex: 1; background: #de3831; }
  #sz-note { position: fixed; left: 20px; right: 20px; bottom: 106px; z-index: 2147483000;
    background: rgba(0, 61, 31, 0.95); color: #fbf8f0; font-family: var(--font-display, Georgia), serif;
    font-size: 38px; line-height: 1.3; padding: 24px 30px; border-left: 8px solid #c98214;
    opacity: 0; transition: opacity 0.5s ease; }
  #sz-end .sz-title { font-size: 104px; font-weight: 700; }
  #sz-end .sz-sub { font-family: var(--font-body, system-ui), system-ui, sans-serif;
    font-size: 34px; margin-top: 24px; color: rgba(251, 248, 240, 0.72); }
`;

async function injectOverlaySystem(page) {
  await page.addStyleTag({ content: OVERLAY_CSS });
}

// For choreography that starts BEFORE the app loads (V3's throttled load):
// paint a brand-green stage on about:blank and mount the overlay system.
async function injectBlankBrand(page) {
  await page.setContent('<body style="margin:0;background:#003d1f;width:100vw;height:100vh"></body>');
  await page.addStyleTag({ content: OVERLAY_CSS });
}

async function showHookStart(page, html) {
  await page.evaluate((h) => {
    const d = document.createElement("div");
    d.id = "sz-hook";
    d.innerHTML = `<div>${h}</div><div class="sz-stripe"><i class="g"></i><i class="a"></i><i class="r"></i></div>`;
    document.body.appendChild(d);
  }, html);
}

async function showHookEnd(page, holdMs) {
  await page.waitForTimeout(holdMs);
  await page.evaluate(() => { const d = document.getElementById("sz-hook"); if (d) d.style.opacity = "0"; });
  await page.waitForTimeout(650);
  await page.evaluate(() => document.getElementById("sz-hook")?.remove());
}

async function dismissConsent(page) {
  // Clicked via the DOM while the hook overlay covers the page, so the
  // banner is never on camera.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /accept all/i.test(b.textContent ?? ""));
    btn?.click();
  });
}

// `atTop` moves the note to the top of the frame. Needed when the thing
// being narrated is itself at the bottom of the screen (a bottom-sheet
// dialog, say) and the default position would cover the very thing the
// note is pointing at.
async function showNote(page, html, holdMs, { atTop = false } = {}) {
  await page.evaluate(({ h, atTop }) => {
    const d = document.createElement("div");
    d.id = "sz-note";
    d.innerHTML = h;
    if (atTop) {
      d.style.top = "120px";
      d.style.bottom = "auto";
    }
    document.body.appendChild(d);
    requestAnimationFrame(() => (d.style.opacity = "1"));
  }, { h: html, atTop });
  await page.waitForTimeout(holdMs);
  await page.evaluate(() => { const d = document.getElementById("sz-note"); if (d) d.style.opacity = "0"; });
  await page.waitForTimeout(550);
  await page.evaluate(() => document.getElementById("sz-note")?.remove());
}

async function showEndCard(page, holdMs) {
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "sz-hook";
    d.innerHTML = `<div id="sz-end"><div class="sz-title">Sebenza</div>
      <div class="sz-sub">Free for job-seekers. Always. &middot; sebenzasa.com</div></div>
      <div class="sz-stripe"><i class="g"></i><i class="a"></i><i class="r"></i></div>`;
    d.style.opacity = "0";
    document.body.appendChild(d);
    requestAnimationFrame(() => (d.style.opacity = "1"));
  });
  await page.waitForTimeout(holdMs);
}

async function smoothScroll(page, totalPx, durationMs) {
  await page.evaluate(
    ({ totalPx, durationMs }) =>
      new Promise((resolve) => {
        const start = performance.now();
        const from = window.scrollY;
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        function step(now) {
          const t = Math.min(1, (now - start) / durationMs);
          window.scrollTo(0, from + totalPx * ease(t));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      }),
    { totalPx, durationMs },
  );
}

// choreography receives (page, markLead) and calls markLead() at the moment
// the hook is fully on screen; everything before that is trimmed away.
async function record(name, choreography) {
  const context = await browser.newContext({
    viewport: VIEW,
    serviceWorkers: "block",
    recordVideo: { dir: outDir, size: VIEW },
  });
  const started = Date.now();
  let leadMs = 0;
  const markLead = () => { leadMs = Date.now() - started; };
  const page = await context.newPage();
  await choreography(page, markLead);
  await context.close();
  const webm = await page.video().path();
  const mp4 = path.join(outDir, name);
  const trim = Math.max(0, leadMs / 1000 - 0.1).toFixed(2);
  const res = spawnSync(
    ffmpeg,
    ["-y", "-ss", trim, "-i", webm, "-vf", "scale=1080:1920:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", mp4],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${res.stderr}`);
  rmSync(webm);
  console.log("recorded", name, `(trimmed ${trim}s lead)`);
}

const browser = await chromium.launch();
const ONLY = process.env.ONLY?.split(",");
const want = (n) => !ONLY || ONLY.some((o) => n.includes(o));

// ---- V1 · The search, live (~20s) ----
if (want("v1")) await record("v1-search-live.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/search`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await injectOverlaySystem(page);
  await showHookStart(page, "Watch talent become <em>findable</em>.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2500);
  const q = page.locator('input[name="q"]');
  await q.click();
  await page.waitForTimeout(400);
  // "developer" is what the seeded showcase register actually contains.
  await q.pressSequentially("developer", { delay: 140 });
  await page.waitForTimeout(600);
  await q.press("Enter");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1600);
  await injectOverlaySystem(page);
  const note = showNote(page, "Real people. Real skills. <em>Ready to work.</em>", 3200);
  await smoothScroll(page, 1900, 6500);
  await note;
  await showNote(page, "Live availability. Honest freshness.", 2600);
  await showEndCard(page, 2800);
});

// ---- V8 · What "verified" actually means (~19s) ----
if (want("v8")) await record("v8-verified-honesty.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/search?q=developer`, { waitUntil: "load" });
  await page.waitForTimeout(1100);
  await injectOverlaySystem(page);
  await showHookStart(page, "Most platforms <em>fake</em> this badge.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2500);
  const note1 = showNote(page, "On Sebenza, unverified means exactly that. <em>No dressing up.</em>", 3400);
  await smoothScroll(page, 650, 3800);
  await note1;
  await page.locator("text=View profile").first().click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(1600);
  await injectOverlaySystem(page);
  const note2 = showNote(page, "Every status carries a date. Stale data sinks, <em>honestly</em>.", 3400);
  await smoothScroll(page, 900, 5000);
  await note2;
  await showNote(page, "<em>Trust</em> is the whole product.", 2600);
  await showEndCard(page, 2800);
});

// ---- V2 · It tells you what to learn next (~23s) ----
// Signed in as the seeded showcase student (andile-z) on the TEST DB,
// whose Career Compass runs on real seeded demand + programme data.
if (want("v2")) await record("v2-learn-next.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill('input[type="email"]', "andile-z@example.co.za");
  await page.fill('input[type="password"]', "sebenza-dev-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
  await page.goto(`${BASE}/dashboard/grow`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "No one tells you <em>which</em> skill gets you hired. This does.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2700);
  const n1 = showNote(page, "What employers near you <em>actually</em> want.", 3400);
  await smoothScroll(page, 900, 4200);
  await n1;
  const n2 = showNote(page, "The gap between you and the role, honestly shown.", 3400);
  await smoothScroll(page, 1100, 4200);
  await n2;
  const n3 = showNote(page, "Real SA routes to close it: SETA, TVET, free courses.", 3400);
  await smoothScroll(page, 1100, 4200);
  await n3;
  await showEndCard(page, 2800);
});

// ---- V3 · Built for slow data (~17s, REAL 3G throttle via CDP) ----
if (want("v3")) await record("v3-slow-data.mp4", async (page, markLead) => {
  await page.goto("about:blank");
  await injectBlankBrand(page);
  await showHookStart(page, "We built this for <em>slow data</em>. On purpose.");
  markLead();
  await showHookEnd(page, 2600);
  // Regular 3G: 750kbps down, 250kbps up, 100ms RTT. The load the viewer
  // watches is genuinely throttled.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 100,
    downloadThroughput: (750 * 1024) / 8, uploadThroughput: (250 * 1024) / 8,
  });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await injectOverlaySystem(page);
  await dismissConsent(page);
  const n1 = showNote(page, "That load you just watched: <em>real 3G speeds</em>, throttled live.", 3600);
  await smoothScroll(page, 700, 4000);
  await n1;
  const n2 = showNote(page, "No heavy graphics. No airtime-eating animations.", 3000);
  await smoothScroll(page, 700, 3600);
  await n2;
  await showNote(page, "Fast and fair beats flashy. <em>Every time.</em>", 2600);
  await showEndCard(page, 2800);
});

// ---- V9 · One platform, four languages (~21s, now REALLY translated) ----
if (want("v9")) await record("v9-four-languages.mp4", async (page, markLead) => {
  const stops = [
    { path: "/", label: "English" },
    { path: "/zu", label: "isiZulu" },
    { path: "/xh", label: "isiXhosa" },
    { path: "/af", label: "Afrikaans" },
  ];
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await injectOverlaySystem(page);
  await showHookStart(page, "Your platform. In <em>your</em> language.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2500);
  for (const stop of stops) {
    await page.goto(`${BASE}${stop.path}`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await injectOverlaySystem(page);
    const note = showNote(page, `<em>${stop.label}</em>`, 2400);
    await smoothScroll(page, 420, 2600);
    await note;
  }
  await injectOverlaySystem(page);
  await showNote(page, "English &middot; isiZulu &middot; isiXhosa &middot; Afrikaans. Built for the real South Africa.", 3000);
  await showEndCard(page, 2800);
});

// ---- V10 · The live skills map (~19s) ----
if (want("v10")) await record("v10-skills-map.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/insights`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "South Africa can't see its own <em>skills gaps</em>. Until now.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2700);
  const n1 = showNote(page, "Live, aggregate, anonymised. <em>Never a person.</em>", 3400);
  await smoothScroll(page, 2100, 4200);
  await n1;
  // Land on the skills-gap table: real searches-vs-matches data, the money shot.
  const n2 = showNote(page, "Which skills employers want but <em>can't find</em>. And where.", 3600);
  await smoothScroll(page, 1500, 4400);
  await n2;
  await showNote(page, "Not last year's survey. <em>Right now.</em>", 2800);
  await showEndCard(page, 2800);
});

// ---- V13 · You get found (~22s) ----
// The other half of V6's promise. V6 says "employers search, YOU get
// found"; nothing in the bank ever showed the getting-found part. This
// films the real Phase 29.4 funnel on the PUBLIC /search page: tick
// candidates, the selection bar rises, the invite dialog opens, the
// vacancy is picked, invitations go out. The close is the honest
// result line, which says out loud that some people could not be
// invited because they have not consented. That sentence is the whole
// brand in the product's own words, so the video ends on it.
if (want("v13")) await record("v13-you-get-found.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill('input[type="email"]', "naledi.khumalo@discovery.co.za");
  await page.fill('input[type="password"]', "sebenza-dev-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/employer**", { timeout: 30000 });
  await page.goto(`${BASE}/search?q=developer`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "You don't apply. <em>They come to you.</em>");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2700);

  const n1 = showNote(page, "A real employer, searching a skill and a city.", 3200);
  await smoothScroll(page, 700, 3600);
  await n1;

  // Tick three candidates, one at a time, so the bar's count visibly
  // climbs instead of appearing fully formed.
  // Selected BY NAME, never by list position, and the four are chosen
  // deliberately: three hold `vacancy_matching` consent and are clean on
  // this vacancy, and Cohort 08 has never granted it. That is what makes
  // the closing line true. Pick by index instead and the one skip can
  // land on `already_invited` left over from an earlier take, which
  // would make the "consent" claim a lie. Re-seed before recording.
  const n2 = showNote(page, "She picks the people she wants.", 3400);
  for (const who of [
    "Andile Z.",
    "Lerato N.",
    "BSc CS Cohort 06",
    "BSc CS Cohort 08",
  ]) {
    await page.getByLabel(`Select ${who} to invite`).click();
    await page.waitForTimeout(650);
  }
  await n2;
  await page.waitForTimeout(900); // let the bar settle on screen

  await page.getByRole("button", { name: /^Invite$/ }).click();
  await page.waitForTimeout(1100);
  const n3 = showNote(page, "One vacancy. A note in her own words.", 3400, {
    atTop: true,
  });
  // Pick the vacancy that actually fits the search, not merely the first
  // one in the list: inviting developers to an IT support role reads as
  // spam, which is the opposite of the point.
  await page
    .locator("label")
    .filter({ hasText: "Senior Software Engineer" })
    .locator('input[name="invite-selection-vacancy"]')
    .check();
  await page.waitForTimeout(600);
  await page.fill(
    "textarea",
    "Hi, saw your profile and the role looks like a strong match.",
  );
  await n3;

  await page.getByRole("button", { name: /^Send \d+ invitation/ }).click();
  // Hold on the untouched result line first. It is the payoff of the
  // whole video, so nothing covers it, and only then does the closing
  // note come in at the top of the frame.
  await page.waitForTimeout(3000);
  await showNote(
    page,
    "Some can't be invited. <em>Consent isn't optional here.</em>",
    4000,
    { atTop: true },
  );
  await showEndCard(page, 2800);
});

// ---- V14 · The other side of that invite (~20s) ----
// The companion to V13, filmed from the seeker's chair: the same
// invitation V13 just sent, as Andile receives it.
//
// DEPENDS ON V13 having run first in this same session, because the
// invitation it opens is the one V13 created. Record them together:
//   ONLY=v13,v14 node record-app.mjs
//
// It stops at the Accept / Decline choice and never clicks either. The
// point of the video is that the choice belongs to him, so the film
// should not make it for him.
if (want("v14")) await record("v14-the-other-side.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill('input[type="email"]', "andile-z@example.co.za");
  await page.fill('input[type="password"]', "sebenza-dev-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
  await page.goto(`${BASE}/dashboard/invitations`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "This is the other side of that invite.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2600);

  const n1 = showNote(page, "He never applied. <em>He was found.</em>", 3400);
  await page.waitForTimeout(2400);
  await n1;

  await page
    .getByRole("link", { name: /Senior Software Engineer at Discovery/i })
    .first()
    .click();
  await page.waitForTimeout(1800);

  // Describes only what is actually on this screen. The employer's
  // personal note is NOT rendered here (it goes out in the invite
  // email), so the note must not claim it is.
  const n2 = showNote(page, "The role, the pay, and how long he has.", 3600);
  await smoothScroll(page, 800, 4000);
  await n2;

  // Land on the response actions and hold. Nothing is clicked.
  await smoothScroll(page, 700, 3200);
  await showNote(
    page,
    "Accept, or don't. <em>His call, not ours.</em>",
    4000,
    { atTop: true },
  );
  await showEndCard(page, 2800);
});


// ---- V15 · Highlight SA citizens (~21s) ----
// The Citizen-Visibility Rule, on camera: the toggle GROUPS South
// Africans first, it never removes anyone. The overlays say exactly
// that, because the honesty IS the pitch (Location-Not-Nationality).
if (want("v15")) await record("v15-highlight-sa.mp4", async (page, markLead) => {
  await page.goto(`${BASE}/search?q=developer`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "One tap groups <em>South Africans</em> first.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2600);

  const n1 = showNote(page, "Employers sometimes must hire local. So we made it <em>honest</em>.", 3200);
  await smoothScroll(page, 420, 3200);
  await n1;

  // Scope every interaction to the OPEN sheet: the hidden desktop
  // filter rail carries the same labels and getByText would match it
  // (invisible) and wait forever.
  await page.getByRole("button", { name: /open filters/i }).click();
  const sheet = page.getByRole("dialog", { name: /filters/i });
  await sheet.waitFor({ timeout: 5000 }).catch(async () => {
    await page.getByRole("button", { name: /open filters/i }).click();
    await sheet.waitFor({ timeout: 5000 });
  });
  await page.waitForTimeout(600);
  const n2 = showNote(page, "A highlight. <em>Not a filter.</em>", 2800, { atTop: true });
  await sheet.getByText("Highlight SA citizens").click();
  await page.waitForTimeout(1200);
  await n2;
  await sheet.getByRole("button", { name: /^apply$/i }).click();
  await page.waitForTimeout(1600);

  await injectOverlaySystem(page);
  const n3 = showNote(page, "SA citizens grouped first. <em>Nobody removed.</em>", 3400);
  await smoothScroll(page, 900, 4200);
  await n3;
  await showNote(page, "Matched by skill and place. Nationality is shown, <em>never a barrier</em>.", 3200);
  await showEndCard(page, 2800);
});

// ---- V16 · The interview, on the record (~32s) ----
// The real scheduling flow both ways: the employer sets date, time,
// place and instructions in one card; the candidate opens the same
// facts and confirms. Stage: clear any active interview on the seeded
// vacancy so retakes don't hit the one-active-per-invitation index.
if (want("v16")) await record("v16-interview-scheduled.mp4", async (page, markLead) => {
  stageSql("DELETE FROM interviews WHERE vacancy_id='vac_senior-software-engineer'");
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill('input[type="email"]', "naledi.khumalo@discovery.co.za");
  await page.fill('input[type="password"]', "sebenza-dev-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/employer**", { timeout: 30000 });
  await page.goto(`${BASE}/employer/vacancies/vac_senior-software-engineer`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "Interviews used to happen over <em>WhatsApp</em>. Not any more.");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2600);

  const n1 = showNote(page, "An accepted candidate, waiting on a time.", 2800);
  await smoothScroll(page, 760, 3400);
  await n1;

  await page
    .locator("li", { hasText: "Chiamaka" })
    .getByRole("button", { name: /schedule interview/i })
    .first()
    .click();
  await page.waitForTimeout(900);

  // Date: three days out (page forward if the month rolls over).
  const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await page.locator("#interview-date").click();
  await page.waitForTimeout(600);
  if (target.getMonth() !== new Date().getMonth()) {
    await page.getByRole("button", { name: /next/i }).first().click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("option", { name: new RegExp(`^${target.getDate()}$`) }).first().click();
  await page.waitForTimeout(700);
  await page.locator("#interview-time").click();
  await page.waitForTimeout(600);
  await page.getByRole("option", { name: "10:00" }).click();
  await page.waitForTimeout(600);
  const n2 = showNote(page, "Date, time, format, place, instructions. <em>One card.</em>", 3600, { atTop: true });
  await page.locator("#interview-location").fill("1 Discovery Place, Sandton");
  await page.waitForTimeout(500);
  await page.locator("#interview-instructions").fill("Ask for Naledi at reception. Parking on level B2.");
  await page.waitForTimeout(700);
  await n2;
  await page.getByRole("button", { name: /^schedule$/i }).click();
  await page.waitForTimeout(2000);
  await injectOverlaySystem(page);
  await showNote(page, "Sent. The candidate gets every detail, <em>instantly</em>.", 3000);

  // The other chair: the candidate opens the same facts and answers.
  await page.context().clearCookies();
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill('input[type="email"]', "chiamaka-o@example.co.za");
  await page.fill('input[type="password"]', "sebenza-dev-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
  await page.goto(`${BASE}/dashboard/invitations`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  // Fresh session after clearCookies: the consent banner is back.
  await dismissConsent(page);
  await page.waitForTimeout(400);
  await page
    .getByRole("link", { name: /Senior Software Engineer at Discovery/i })
    .first()
    .click();
  await page.waitForTimeout(1800);
  await injectOverlaySystem(page);
  const n3 = showNote(page, "When, where, what to bring. <em>Add to calendar, one tap.</em>", 3600);
  await smoothScroll(page, 700, 3800);
  await n3;
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await page.waitForTimeout(1800);
  await showNote(page, "Confirmed. Both sides see the <em>same facts</em>.", 3000);
  await showEndCard(page, 2800);
});

// ---- V17 · From attended to hired (~24s) ----
// Attendance closes the loop into Placement-Truth: the agenda asks the
// one honest question, an attended interview becomes "Log this hire",
// and the hire lands on the national record. Staged: a confirmed
// interview 3 hours in the past for the seeded accepted invitee.
if (want("v17")) await record("v17-attended-to-hired.mp4", async (page, markLead) => {
  stageSql("DELETE FROM interviews WHERE vacancy_id='vac_senior-software-engineer'");
  stageSql("INSERT INTO interviews (id, invitation_id, vacancy_id, organization_id, profile_id, scheduled_by_user_id, starts_at, duration_minutes, location_kind, location, instructions, state, responded_at) SELECT 'int_video-v17', vi.id, vi.vacancy_id, 'org_discovery-bank', vi.profile_id, 'user_naledi-k', now() - interval '3 hours', 45, 'in_person', '1 Discovery Place, Sandton', 'Ask for Naledi at reception.', 'confirmed', now() - interval '2 days' FROM vacancy_invitations vi WHERE vi.vacancy_id='vac_senior-software-engineer' AND vi.profile_id='prof_chiamaka-o'");
  // The showcase story: Discovery revealed her contact when she accepted
  // (the real flow requires it before scheduling), so the dossier's
  // mark-as-hired card shows its ready state, not the reveal gate.
  stageSql("INSERT INTO audit_log (id, kind, actor, subject, meta, at) VALUES ('aud_video-v17-reveal', 'profile.contact.reveal', 'user_naledi-k', 'prof_chiamaka-o', json_build_object('orgId', 'org_discovery-bank')::jsonb, now() - interval '2 days') ON CONFLICT (id) DO UPDATE SET at = now() - interval '2 days'");
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.fill('input[type="email"]', "naledi.khumalo@discovery.co.za");
  await page.fill('input[type="password"]', "sebenza-dev-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/employer**", { timeout: 30000 });
  await page.goto(`${BASE}/employer/interviews`, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  await injectOverlaySystem(page);
  await showHookStart(page, "The interview happened. <em>Then what?</em>");
  markLead();
  await dismissConsent(page);
  await showHookEnd(page, 2600);

  const n1 = showNote(page, "One honest question: <em>did they attend?</em>", 3200);
  await page.waitForTimeout(2600);
  await n1;
  await page.getByRole("button", { name: /^attended$/i }).first().click();
  await page.waitForTimeout(2200);
  await injectOverlaySystem(page);
  const n2 = showNote(page, "Attended becomes a doorway: <em>Log this hire.</em>", 3400);
  await page.waitForTimeout(2800);
  await n2;
  await page.getByRole("link", { name: /log this hire/i }).first().click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(1800);
  await injectOverlaySystem(page);
  const n3 = showNote(page, "The vacancy rides along. Role, date, done.", 3400);
  await smoothScroll(page, 600, 3600);
  await n3;
  await showNote(page, "A hire only counts when it's <em>confirmed</em>. That's the rule.", 3200);
  await showEndCard(page, 2800);
});

await browser.close();
console.log("done");
