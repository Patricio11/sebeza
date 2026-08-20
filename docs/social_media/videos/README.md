# Sebenza video pipeline (the shorts, machine-made)

The short videos from `../tiktok/SEBENZA_VIDEO_BANK.md`, produced by code instead of by hand:
brand-choreographed HTML animations for the text-driven scripts, and Playwright driving the
REAL app for the product demos. Output: 1080x1920 MP4 (H.264, 30fps), ready for TikTok,
YouTube Shorts, and Instagram Reels.

**Silent on purpose.** Add the calm instrumental sound bed in the TikTok/Instagram editor at
post time; music licensing lives inside those apps. Everything else (hooks, overlays, end
cards, the flag stripe) is baked in.

## The videos

| File | Bank | What it is |
|---|---|---|
| `v1-search-live.mp4` (~20s) | V1 | The real /search: typing "developer", live results, honest badges + freshness, overlay notes. |
| `v5-to-work.mp4` (~12s) | V5 | The anthem: mark, wordmark, "to work.", stripe sweep. Pin this one. |
| `v6-cv-pile.mp4` (~20s) | V6 | The text-driven CV-pile story ("number 347" → "You get found"). |
| `v8-verified-honesty.mp4` (~19s) | V8 | The real register: Unverified badges shown honestly, a real profile with status date + audit strip. |
| `v12-free-means-free.mp4` (~15s) | V12 | The R0 slam + the promise end-card. |
| `v2-learn-next.mp4` (~19s) | V2 | The real Career Compass, signed in as the seeded showcase student: demand-ranked skills, the gap, real SA routes (SETA/TVET), the student lane. |
| `v3-slow-data.mp4` (~23s) | V3 | The landing loading under a REAL 3G throttle (CDP-emulated live, and the overlay says so honestly). |
| `v4-boring-work.mp4` (~18s) | V4 | A real vitest run (23 files / 275 tests, captured verbatim) replayed in a branded terminal. |
| `v7-scam-signs.mp4` (~19s) | V7 | The three scam red flags, red alert cards. |
| `v9-four-languages.mp4` (~25s) | V9 | The REAL translated landing: English → isiZulu → isiXhosa → Afrikaans, "South Africa" kept untranslated per the house rule. |
| `v13-you-get-found.mp4` (~22s) | V13 | The real Phase 29.4 invite funnel on public /search: selection bar, invite dialog, vacancy picked, invitations sent, and the honest "1 couldn't receive an invite" result. |
| `v10-skills-map.mp4` (~18s) | V10 | /insights live: status mix, the province × profession supply heatmap, skill-level demand. |

**V9 is now filmed for real**: the zu/xh/af catalogs are full translations (pending human
review) and the landing is catalog-driven, so the demo shows the genuine product. Recommended:
publish V9 after the reviewer signs off the catalogs. Still open: V11 (the repeatable build-log
series; film an episode whenever something real ships).

## Safety rule

Product demos record ONLY against the E2E test server (production build + the disposable
Docker test database with seeded showcase data). `serve-app.mjs` refuses to start without
`SEBENZA_TEST_DB=1`. Never record against the live register.

## Regenerating

```bash
# one-time: cd docs/social_media/videos && npm install   (ffmpeg-static)
docker start sebenza-test-pg

# text-driven card videos (no app needed):
node docs/social_media/videos/src/record-cards.mjs

# product demos (start the app first, wait for "Ready"):
node docs/social_media/videos/src/serve-app.mjs        # keep running
node docs/social_media/videos/src/record-app.mjs
```

## Making a new video

- Text-driven: copy a `card-*.html`, choreograph scenes with CSS keyframe delays (animations
  start when the recorder adds `body.play`; the HOOK scene must be visible pre-play so it is
  on frame one), add it to the manifest in `record-cards.mjs`.
- Product demo: add a `record(...)` block in `record-app.mjs` using the overlay system
  (showHookStart/End, showNote, showEndCard, smoothScroll). Call `markLead()` when the hook is
  on screen; everything before it is trimmed.

Hard-won recording rules (do not relearn these):
- `recordVideo.size` MUST equal the viewport or frames letterbox into a corner. App demos
  record at 756x1344 (largest exact 9:16 under Tailwind's md=768, so the layout stays mobile)
  and upscale to 1080x1920 in ffmpeg.
- Dismiss the cookie banner via DOM click while the hook overlay covers the page.
- Search demos use the query "developer": that's what the seeded showcase register contains.
- No em-dashes in overlay text; the overlay uses the app's own font variables.
