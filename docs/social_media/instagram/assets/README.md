# Sebenza Instagram asset kit

Same system as the Facebook kit (`../../facebook/assets/README.md`): HTML templates in `src/`
rendered to PNGs, the chevron mark extracted live from `public/sebenza-logo.svg`, the flag
stripe (green : gold : red at **3 : 2 : 1**) on every graphic. The flag-stripe law and palette
are documented in the Facebook README; they apply here unchanged.

**Feed cards are shared with Facebook** (`../../facebook/assets/post-*.png`, already 1080x1350,
Instagram's native portrait ratio). This folder holds only what Instagram alone needs.

## Files

| File | Size | Use |
|---|---|---|
| `profile-picture.png` | 1080x1080 | Same file as Facebook, on purpose: one avatar across platforms. |
| `story-intro.png` | 1080x1920 | First story; the lockup + "to work". |
| `story-question.png` | 1080x1920 | Question story; place IG's question sticker over the dashed panel. |
| `story-free-always.png` | 1080x1920 | Promise story; pair with a poll sticker. |
| `story-trust.png` | 1080x1920 | Honesty story; pair with a quiz sticker. |
| `story-scam-warning.png` | 1080x1920 | Scam PSA story (red alert card); reshare monthly. |
| `carousel-promise-1-cover.png` … `-6-proudly.png` | 1080x1350 ×6 | The promise carousel, posted in numeric order (cover first). |

**Story safe zones:** all story cards keep the top and bottom ~250px free of content because
Instagram overlays its camera and reply UI there. Keep stickers in the middle band too.

## Regenerating / new cards

```bash
# from the repo root (sebenza_v1)
node docs/social_media/instagram/assets/src/render.mjs
```

Templates: `story.html` (themed quote story; `sticker: true` in the manifest shows the
sticker panel), `story-intro.html`, `carousel.html` (one promise per slide),
`carousel-cover.html`. A new story or slide is a five-line entry in the `CARDS` manifest in
`src/render.mjs`, exactly like the Facebook kit.
