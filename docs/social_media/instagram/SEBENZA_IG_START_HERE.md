# SEBENZA · INSTAGRAM START HERE
**The complete kit to create the Instagram account: identity, settings, assets, the grid, and the first week.**
*Read this first, then `SEBENZA_IG_PLAYBOOK.md` (strategy), `SEBENZA_IG_POSTS.md` (feed + carousel +
Reels) and `SEBENZA_IG_STORIES.md` (stories). The Facebook voice files apply here too.*

> **The same gate as Facebook.** Presence and story, never acquisition. No "sign up" CTAs and no
> paid ads until the launch gates in the Facebook playbook clear. "Link in bio" pointing at
> sebenzasa.com is fine.

---

## 1 · The identity (one brand, two platforms)

| Setting | Value |
|---|---|
| **Name** (display) | `Sebenza SA` (same as the Facebook page) |
| **Username** | `@sebenzasa` (matches the domain and the FB handle; one name everywhere). Fallbacks: `@sebenza.sa`, `@sebenzasouthafrica`. |
| **Profile picture** | `assets/profile-picture.png` (the same file as Facebook, on purpose: one avatar, instantly recognisable across platforms) |
| **Bio** (150 chars max) | `South Africa's national talent platform 🇿🇦`<br>`Free for job-seekers. Always.`<br>`Built here, for here. Building in the open.` |
| **Link** | `https://sebenzasa.com` |
| **Category** | `Software company` (fallback: `Internet company`) |
| **Contact** | `info@sebenzasa.com` |
| **Account type** | Professional → **Business** (unlocks insights, contact button, and Meta Business Suite scheduling) |

**Voice:** identical to Facebook. The page speaks as **"we"**; the founder stays off-camera for
now. No em-dashes anywhere. Never name the incumbent registry. Never invent traction.

---

## 2 · Create the account, step by step

- [x] 1. In the Instagram app: create a new account with `info@sebenzasa.com`.
      Username `@sebenzasa`, display name `Sebenza SA`.
- [x] 2. **Turn on two-factor authentication immediately** (Settings → Accounts Centre →
      Password and security). Same rule as Facebook: the account is only as safe as its login.
- [x] 3. Switch to a professional account: Settings → Account type and tools →
      Switch to professional account → **Business** → category `Software company`.
- [x] 4. Add the bio (table above), the link `https://sebenzasa.com`, and the contact
      email. Upload `assets/profile-picture.png`.
- [x] 5. **Connect it to the Facebook Page**: Accounts Centre → Accounts → add both
      Sebenza SA accounts. This unlocks cross-posting, the shared inbox, and
      scheduling from Meta Business Suite.
- [x] 6. Set the page region/language expectations by simply posting SA content;
      Instagram has no region setting to configure.

---

## 3 · The grid is the landing page

On Instagram, a visitor sees the **grid** before any single post: nine tiles that either look
like a designed magazine or a mess. Ours will look designed because every card shares the type,
the palette, and the flag stripe. Two rules keep it that way:

1. **Alternate the tile tone**: never two dark cards or two light cards next to each other in
   posting order. Dark, light, photo, dark, light... The grid checkerboards by itself.
2. **Photos and screenshots break the cards up.** A grid of only quote-cards reads as a brand
   account with nothing behind it; workspace shots and product screenshots prove the build.

**The first nine posts, in posting order** (the intro sequence mirrors Facebook):

| # | Post | Tile |
|---|---|---|
| 1 | Intro ("to work") | dark card `../facebook/assets/post-01-intro.png` |
| 2 | Who's behind this | light card (`facebook/assets/post-02-who.png`; no workspace photos yet) |
| 3 | The one-liner | product screenshot (branded frame) |
| 4 | Talent is invisible | light card `../facebook/assets/post-04-talent-invisible.png` |
| 5 | **The promise carousel** | dark cover `assets/carousel-promise-1-cover.png` (+ 5 slides) |
| 6 | Dignity | light card `../facebook/assets/post-05-dignity.png` |
| 7 | Free always | dark card `../facebook/assets/post-06-free-always.png` |
| 8 | Cheap phone rule | light card `../facebook/assets/post-09-cheap-phone.png` |
| 9 | Trust | dark card `../facebook/assets/post-10-trust.png` |

---

## 4 · The first week

- [x] 1. Post 1 (intro card) the day the account exists; the grid must never be empty.
- [x] 2. Same day: run `assets/story-intro.png` as the first **story**.
- [ ] 3. Follow ~20 relevant SA accounts (youth orgs, TVET colleges, SA tech, careers
      pages). Follow, don't spam-comment.
- [ ] 4. Two days later: post 2 (post-02-who card) + the question **story**
      (`assets/story-question.png` with Instagram's question sticker placed over the
      panel; see `SEBENZA_IG_STORIES.md`).
- [ ] 5. Two days after: post 3 (product screenshot). From then on, the playbook
      cadence: 3 feed posts a week shared with Facebook, 2-3 stories a week, one Reel
      when there is something worth recording.
- [ ] 6. Reply to every comment and every story reply. On Instagram, DMs and story
      replies are where the community actually forms.

---

## 5 · What's in the asset kit

Feed cards are **shared with Facebook** (same 1080x1350 files; Instagram's native portrait
ratio). This folder adds what Instagram alone needs. Full manifest: `assets/README.md`.

- 5 **story cards** (1080x1920, safe-zoned): intro, free-always, trust, scam warning,
  and the question card with a built-in panel for the question sticker.
- The **promise carousel**: cover + 5 slides, one promise per slide.
- The shared profile picture.

New cards (feed, story, or carousel) are a five-line manifest entry in
`assets/src/render.mjs`. Ask Claude.
