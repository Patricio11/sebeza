# SEBENZA · STORIES (Instagram + Facebook)

**Twenty pre-rendered story cards in `assets/` (1080x1920). One set serves BOTH platforms:
post to Instagram Stories, then use Instagram's "share to Facebook" toggle (or post the same
PNG to the Facebook Page's story). Same gate and standing rules as every platform...**

**How to post any card:** get the PNG onto your phone (WhatsApp/email it to yourself) → open
Instagram → Your story → pick the image → share (toggle Facebook sharing ON in story settings
once, then it's automatic). **Add no text of your own**: the card is the whole story. Where a
sticker is called for, the table says exactly which one.

**Safe zones:** every card keeps the top and bottom ~250px clear. Put stickers in the middle
band. The three sticker cards have a dashed panel showing exactly where the sticker goes:
cover the panel completely.

---

## THE CARDS

### Identity + promise

| File | What it shows | How to use |
|---|---|---|
| `assets/story-towork.png` | "To work." on deep green | Day one, and whenever new followers arrive in a wave. |
| `assets/story-dignity.png` | The dignity pull-quote | The brand's soul. Run it on quiet weeks; it always lands. |
| `assets/story-r0.png` | Giant R0, "Not now. Not ever." | Monthly. The single most shareable promise. |

### The flip (why Sebenza is different)

| File | What it shows | How to use |
|---|---|---|
| `assets/story-cv-pile.png` | "Your CV is number 347 in a pile nobody opens." | Pair over two days with story-get-found (this one first: problem, then answer). |
| `assets/story-get-found.png` | "Stop applying. Get found." | Day two of the pair. Add a LINK sticker to sebenzasa.com if desired. |
| `assets/story-decline-free.png` | "Saying no costs you nothing." | After any invite-themed feed post; it answers the fear directly. |

### The loop (the product working)

| File | What it shows | How to use |
|---|---|---|
| `assets/story-the-loop.png` | Four chevron steps, found → hired | Run when the interview/hire videos post; it is the same story in one frame. |
| `assets/story-interview.png` | "The interview lands on the record." | New-feature announcement. Pairs with the V16 short the same day. |

### Honesty

| File | What it shows | How to use |
|---|---|---|
| `assets/story-verified.png` | "If we didn't check it, it says unverified." | Pair with a QUIZ sticker: "What does an unverified badge mean here?" (Answer: exactly that.) |
| `assets/story-hire-local.png` | "Hire local, honestly." | Run alongside the V15 short. |
| `assets/story-privacy.png` | "Your number is yours." | POPIA in one line. Good after any privacy question arrives. |

### Built for the real South Africa

| File | What it shows | How to use |
|---|---|---|
| `assets/story-3g.png` | "Made for a R1500 phone on 3G." | Pairs with the V3 short. |
| `assets/story-languages.png` | Numbered list: English, isiZulu, isiXhosa, Afrikaans | Run after the translation review signs off (same hold rule as the V9 short). |
| `assets/story-skills-map.png` | "South Africa's skills gaps, live." | Pairs with the V10 short or any insights feed post. |

### Protect the community

| File | What it shows | How to use |
|---|---|---|
| `assets/story-scam-3signs.png` | The 3 scam red flags, numbered in red | Worth re-running MONTHLY. Ask viewers to share it forward. |
| `assets/story-share.png` | "Know someone looking? Send them this." | The referral nudge. Run it after anything that got strong replies. |

### Employer-facing

| File | What it shows | How to use |
|---|---|---|
| `assets/story-employers.png` | "Search talent like you search anything else." | Occasional. Most story viewers are seekers; once a month is enough. |

### Sticker stories (interactive; the dashed panel marks the sticker spot)

| File | What it shows | Sticker to add |
|---|---|---|
| `assets/story-poll-hunting.png` | "Job hunting right now?" | POLL: "Yes, actively" / "Keeping an eye out". Reply privately to actives with a warm one-liner + link. |
| `assets/story-ask-anything.png` | "Ask us anything about Sebenza." | QUESTION sticker. Answer the best ones as follow-up stories (anonymous, never identifying). |
| `assets/story-countdown.png` | "Something new lands this week." | COUNTDOWN sticker. Only when something real ships that week; a countdown to nothing burns trust. |

---

## CADENCE (2-3 stories a week; more when something ships)

- **Week rhythm:** one promise/identity card + one interactive (sticker) card, plus the card
  that pairs with that week's video (the calendar's Wednesday short).
- **Pairs stay together:** cv-pile → get-found on consecutive days; the-loop + interview the
  week the interview feature is announced.
- **Monthly repeats are a feature, not laziness:** scam-3signs and r0 are the two cards worth
  reposting forever; stories vanish in 24 hours and the audience keeps changing.
- **Reshare feed posts to the story** the day they publish (one tap; drives the feed) - that
  counts toward the cadence.

## RE-RENDERING / ADDING CARDS

```bash
node docs/social_media/stories/assets/src/render.mjs     # from the repo root
```

Add a card = one entry in the manifest in `render.mjs` (theme light/dark/alert; layout
headline/figure/list/quote/steps; `sticker: true` for the dashed panel). House rules apply: no
em-dashes, "South Africa" never translated, honesty guardrails as everywhere else.
