# Sebenza social media

One brand, one voice, per-platform kits. Everything visual comes from the product's own design
system: Fraunces + Hanken Grotesk, the Mzansi palette, the chevron mark (extracted live from
`public/sebenza-logo.svg` at render time), and the **flag stripe** (green : gold : red at
3 : 2 : 1) on every post graphic.

**Standing rules across all platforms:** the account speaks as "we" (founder off-camera for
now); no em-dashes anywhere; no sign-up CTAs or paid ads until the launch gates clear
(immigration consult + Information Officer registration; see the Facebook playbook's gate);
never name the incumbent registry; never invent traction; no real PII in screenshots.

| Platform | Kit | Status |
|---|---|---|
| **Facebook** (`facebook/`) | START_HERE (page creation) · PLAYBOOK (strategy) · POSTS (30-post bank) · 2 VOICE files · `assets/` (profile, cover, 11 post cards + render pipeline) | Page live: **Sebenza SA** |
| **Instagram** (`instagram/`) | START_HERE (account creation + grid plan) · PLAYBOOK · POSTS (feed + carousel + Reels) · STORIES · `assets/` (5 story cards, promise carousel, shared avatar + render pipeline) | Kit ready |

Feed graphics are shared: the Facebook post cards are 1080x1350, which is also Instagram's
native portrait ratio. Instagram adds stories (1080x1920) and carousels on top.

To mint any new graphic: add a manifest entry in the platform's `assets/src/render.mjs` and run
it from the repo root (uses the repo's Playwright). Ask Claude.
