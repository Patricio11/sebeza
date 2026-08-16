# SEBENZA · X START HERE
**Account creation + how X fits the system. The tweet bank is in `SEBENZA_X_POSTS.md`.**

> Same gate and standing rules as every platform: presence not acquisition, we-voice, founder
> off-camera, no em-dashes, never name the incumbent, no invented traction.

---

## 1 · The identity

| Setting | Value |
|---|---|
| **Name** | `Sebenza SA` |
| **Handle** | `@sebenzasa` (fallbacks: `@sebenza_sa`, `@sebenzasouthafrica`) |
| **Profile picture** | `assets/profile-picture.png` (same file as every platform) |
| **Header** | `assets/header-x.png` (1500x500, pre-rendered) |
| **Bio** (160 chars) | `South Africa's national talent platform. Job-seekers get found for what they can do. Free for seekers, always. Built here, for here. 🇿🇦` (139 chars) |
| **Location** | `South Africa` |
| **Website** | `https://sebenzasa.com` |
| **Email for the account** | `info@sebenzasa.com` |

## 2 · Create it, step by step

- [ ] 1. Sign up with `info@sebenzasa.com`, handle `@sebenzasa`, name `Sebenza SA`.
- [ ] 2. **Two-factor authentication on immediately** (Settings → Security and account access).
- [ ] 3. Avatar, header, bio, location, website from the table.
- [ ] 4. First post: the X version of the introduction (post X-1 in the bank). **Pin it.**
- [ ] 5. Follow ~30 accounts: SA tech, SA economics/labour journalists, TVET/SETA bodies,
      youth organisations, build-in-public developers. X is a conversation graph; who you
      follow shapes what you see and who sees you.

## 3 · What X is FOR in our system

X in South Africa is where **journalists, policy people, economists, employers, and the tech
community** talk. It is not where most job-seekers are; that's TikTok/Facebook. So the X account
speaks slightly more to the **system side** of the mission: the build, the data story, the
labour-market honesty. Same voice, more precision.

Three lanes:
1. **Build-in-public** (highest engagement on X): short, specific, honest updates about what
   got built this week. The developer community amplifies real work.
2. **Mission takes**: the sharp true things from the voice files ("SA doesn't have a talent
   problem, it has a nobody-can-find-the-talent problem").
3. **Threads** (~1/week max): the deep dives; the bank has two ready.

## 4 · X-specific craft

- **Text does the work.** Cards attach well (the 1080x1350 cards render fine in-timeline) but
  on X a strong plain-text post often outperforms an image post. Use cards on ~half the posts.
- **One idea per post.** Threads for anything longer; never a screenshot-of-text.
- **No hashtag walls**: on X, 0-1 hashtags. Hashtags are basically dead there; discovery is
  retweets and replies.
- **Reply culture**: spend the daily ten minutes replying to SA unemployment/tech conversations
  where we genuinely add something. That, not posting, is how a small X account grows.
- **Never argue.** Correct facts once, politely, or leave it. Screenshots live forever.

## 5 · Assets

`assets/header-x.png` (header) + `assets/profile-picture.png` (avatar) + reuse the Facebook
feed cards (`../facebook/assets/post-*.png`) as attached images where a post maps to one.
Regenerate the header: `node docs/social_media/x/assets/src/render.mjs`.
