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

**V9 (four languages) is ON HOLD**: the zu/xh/af catalogs are still placeholder fallbacks to
English (3/2/2 strings vs 606 in en), so that demo cannot honestly be filmed yet. It unblocks
the day real human translations land. Verification-Honesty applies to our own marketing.

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
