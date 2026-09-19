# Sebenza Facebook asset kit

Every graphic here is rendered from the HTML templates in `src/`, in the real brand:
Fraunces + Hanken Grotesk, the Mzansi National palette, the chevron person-mark taken
live from `public/sebenza-logo.svg` (it can never drift from the product), and the
**flag stripe** on every single post graphic.

## The flag stripe (non-negotiable)

Green, gold, red, in the ratio **3 : 2 : 1**, always in that order, full-bleed at the
very bottom of every post graphic. It is the same stripe the product ships in the PWA
app icon and on the 404 and error pages. Colours:

| Segment | Light surfaces | Deep-green surfaces |
|---|---|---|
| Green (flex 3) | `#006b3c` | `#0a8c50` (lifted for contrast, same as the app's hover green) |
| Gold (flex 2) | `#c98214` | `#c98214` |
| Red (flex 1) | `#de3831` | `#de3831` |

Red appears nowhere else on a graphic except the stripe, unless the card is a warning
(the scam card), where red is doing its real job: alerts only, never decorative.

## Files

| File | Size | Use |
|---|---|---|
| `profile-picture.png` | 1080x1080 | Page profile picture. Matches the PWA icon (Fraunces S), stripe kept short and centred so the circle crop never clips it. |
| `cover-photo.png` | 1640x624 | Page cover. All content sits in the central 1000px so the mobile crop never cuts it. |
| `post-01-intro.png` | 1080x1350 | Post 1: the introduction (logo + "to work"). Pin this post. |
| `post-04-talent-invisible.png` | 1080x1350 | Post 4: "talent is invisible" quote card. |
| `post-05-dignity.png` | 1080x1350 | Post 5: "Being seen matters" quote card. |
| `post-06-free-always.png` | 1080x1350 | Post 6: "Free for job-seekers. Always." (dark). |
| `post-07-for-everyone.png` | 1080x1350 | Post 7: "Talent is talent. We help it get found." mission quote card (light). Also the IG feed graphic (4:5). |
| `post-08-why-we-started.png` | 1080x1350 | Post 8: BTS montage, three real product shots fanned (search, compass, insights) from the seeded showcase register. Same file for IG. |
| `post-11-hard-parts.png` | 1080x1350 | Post 11: "Some nights it's magic..." BTS quote card (dark). Same file for IG. |
| `post-12-what-to-learn.png` | 1080x1350 | Post 12: "what to learn next", the real Career compass recommendations on a product card. Same file for IG. |
| `post-14-available-now.png` | 1080x1350 | Post 14: "Live, honest, current." A real search result card with the status + freshness chip. Same file for IG. |
| `post-15-for-employers.png` | 1080x1350 | Post 15: "Skilled people near you, in minutes." Search bar + results headline + first card. Same file for IG. |
| `post-16-bigger-picture.png` | 1080x1350 | Post 16: "A live map of the country's skills gaps." The public insights skills-gap table. Same file for IG. |
| `post-17-the-dream.png` | 1080x1350 | Post 17: the aspirational quote card (dark). Same file for IG. |
| `post-18-students.png` | 1080x1350 | Post 18: "Bridge your degree to the market." Career compass student-mode header. Same file for IG. |
| `post-19-cv-tip.png` | 1080x1350 | Post 19: CV tip, numbered list card. Same file for IG. |
| `post-20-interview-tip.png` | 1080x1350 | Post 20: interview tip, numbered list card (dark). Same file for IG. |
| `post-21-in-demand.png` | 1080x1350 | Post 21: skills in demand, list card. Same file for IG. |
| `post-22-free-learning.png` | 1080x1350 | Post 22: free SA learning routes, list card. Same file for IG. |
| `post-09-cheap-phone.png` | 1080x1350 | Post 9: the cheap-phone / slow-data design rule. |
| `post-10-trust.png` | 1080x1350 | Post 10: "Trust is the whole product." (dark). |
| `post-13-the-name.png` | 1080x1350 | Post 13: why the name Sebenza. |
| `post-23-scam-warning.png` | 1080x1350 | Post 23: job-scam warning (red alert card). |
| `post-25-youth.png` | 1080x1350 | Post 25: youth unemployment card. |
| `post-26-question.png` | 1080x1350 | Post 26: the community question (dark). |
| `post-30-promise.png` | 1080x1350 | Post 30: the promise checklist. |

Posts 1080x1350 (4:5 portrait) on purpose: it is the tallest ratio Facebook shows
uncropped in feed, so the cards take maximum screen space on a phone.

## Regenerating / making new cards

```bash
# from the repo root (sebenza_v1). Uses the repo's own Playwright.
node docs/social_media/facebook/assets/src/render.mjs
```

To mint a new quote card, add one entry to the `CARDS` manifest in
`src/render.mjs` (template `quote.html`, pick `theme: "light" | "dark" | "alert"`,
an eyebrow, a headline with `<em>...</em>` around the one accent word, an optional
sub line, and a headline size that fits) and run the script. The stripe, lockup,
fonts and margins are all baked into the template, so a new card is a five-line
manifest entry, never a design job.

Special layouts have their own templates: `intro.html` (logo card),
`checklist.html` (promise list), `list.html` (tip cards: `items` of `{ lead, body }`,
`marker: "number" | "dot"`, light or dark), `product.html` (one real screenshot from
`src/shots/`), `montage.html` (three), `cover.html`, `profile.html`.

House copy rule applies to graphics too: **no em-dashes** anywhere on a card.
