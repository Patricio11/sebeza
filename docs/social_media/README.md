# Sebenza social media

One brand, one voice, per-platform kits. Everything visual comes from the product's own design
system: Fraunces + Hanken Grotesk, the Mzansi palette, the chevron mark (extracted live from
`public/sebenza-logo.svg` at render time), and the **flag stripe** (green : gold : red at
3 : 2 : 1) on every graphic.

**Standing rules across all platforms:** the account speaks as "we" (founder off-camera for
now); no em-dashes anywhere; no sign-up CTAs or paid ads until the launch gates clear
(immigration consult + Information Officer registration; see the Facebook playbook's gate);
never name the incumbent registry; never invent traction; no real PII in screenshots or
videos. Handle everywhere: **@sebenzasa**. Name everywhere: **Sebenza SA**. Same avatar file
on every platform.

| Platform | Kit | Role in the system |
|---|---|---|
| **Facebook** (`facebook/`) | START_HERE · PLAYBOOK (the canonical strategy + gate) · POSTS (30-post bank) · 2 VOICE files · assets (profile, cover, 11 post cards) | The community warm-up. Page live: **Sebenza SA**. |
| **Instagram** (`instagram/`) | START_HERE (grid plan) · PLAYBOOK · POSTS (feed/carousel/Reels) · STORIES · assets (5 story cards, promise carousel) | The visual shelf + stories. Feed cards shared with FB. |
| **TikTok** (`tiktok/`) | START_HERE · **SEBENZA_VIDEO_BANK.md** (12 short-video scripts, the single source for TikTok + YouTube Shorts + IG Reels) · assets (8 video covers) | The discovery engine. Youngest audience. |
| **X** (`x/`) | START_HERE · POSTS (15 posts + 2 threads) · assets (1500x500 header) | The system-side conversation: tech, media, policy. |
| **LinkedIn** (`linkedin/`) | START_HERE (company page) · POSTS (10 longer-form posts) · assets (2256x382 banner) | The B2B/institutional channel: employers, partners, government. |
| **YouTube** (`youtube/`) | START_HERE (channel + Shorts metadata per video) · assets (2560x1440 banner) | Shorts now (from the video bank), searchable tutorials post-launch. |

**The video pipeline:** every short is scripted once in `tiktok/SEBENZA_VIDEO_BANK.md` and
posted to TikTok, YouTube Shorts, and Instagram Reels the same day. Clean exports only (no
platform watermarks). Feed cards are shared too: the Facebook 1080x1350 cards are IG-native
and attach well on X and LinkedIn.

To mint any new graphic: add a manifest entry in the platform's `assets/src/render.mjs` and
run it from the repo root (uses the repo's Playwright). Ask Claude.
