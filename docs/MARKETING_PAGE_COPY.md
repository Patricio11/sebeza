# Sebenza `/marketing` page copy *(source of record)*

Final copy for the explainer funnel at **`/marketing`**. This is the page the founder sends instead
of explaining Sebenza over and over: to an employer, a partner, a department, a journalist.

Voice: **plain, direct, calm, honest. Never hypey.** Civic Editorial: bulletin language, thick
rules, short lines that hold at 360px. The build is the ceiling: every claim on this page maps to
something shipped. No invented stats (the numbers render LIVE from the register), no fake
testimonials (the real, consented rail renders when quotes exist), no scarcity, no em-dashes.

> **Tone rule (non-negotiable):** never name the incumbent registry, never compare to it. Sebenza
> stands on what it is, not on what something else isn't.
>
> **This file is the copy-of-record.** The page is built from it in
> `app/[locale]/(public)/marketing/page.tsx` (reuses `SiteHeader`, `TestimonialsRail`,
> `SiteFooter`). Edit the copy here first, then mirror it into the page.

---

## 1 · Hero

**Eyebrow:** South Africa's national talent platform

**Headline:**
Find the person.
**Trust the profile. Count the hire.**

**Subhead:**
Sebenza is a POPIA-first national talent register. Job seekers build one free profile and get
found. Employers search live, freshness-weighted, honestly-verified talent. And the hiring that
follows becomes real labour-market intelligence, not guesswork.

**Primary CTA:** Search the talent register → `/search`
**Secondary CTA:** Create a free profile → `/sign-up/seeker`
**Tertiary (quiet):** Talk to us → `mailto:info@sebenzasa.com`
**Microcopy under the buttons:** Free for job seekers, always. Works on any phone, in English,
isiZulu, isiXhosa and Afrikaans.

---

## 2 · The problem

**Eyebrow:** The reality
**Heading:** Hiring in South Africa runs on noise

- A hundred CVs in a WhatsApp group, and no way to tell who is real.
- Databases where half the "available" people found work months ago.
- Badges that say verified when nobody actually verified anything.
- Job seekers paying to be seen, or losing money to fake recruiters.
- Policy written from surveys that were old before they were published.

**Close:** South Africa does not have a talent shortage. It has a trustworthy-signal shortage.
That is the problem Sebenza fixes.

---

## 3 · Who it's for

**Eyebrow:** Who it's for
**Heading:** One register, three sides

**Job seekers · free, always**
Build one profile: your skills, experience, availability, and where you are. Get found by
verified employers, get invited to real named roles, apply through public vacancy links, and
control every bit of your information under POPIA. From general workers and artisans to graduates
and professionals. Students too.

**Employers · from spaza to enterprise**
Search by skill, place and availability, not by luck. See honest verification states and how
fresh each profile is. Run vacancies: reverse-match candidates, invite them to named roles, share
a public apply link on WhatsApp, and log the hire when it happens.

**Government & institutions**
A privacy-floored, read-only analytics portal: where demand is, where supply is, why roles go
unfilled, why learners stall, and how curriculum lines up with the market. Every figure is
k-anonymised and aggregate. Never an identifiable person.

---

## 4 · What changes with Sebenza

**Eyebrow:** The difference
**Heading:** Honesty is the feature

- **"Unverified" is the default.** *A badge only says verified when something was actually
  verified. We never dress up self-reported data.*
- **Freshness is ranked.** *Every employment status carries a confirmation date. Stale profiles
  fall honestly down the list instead of wasting your calls.*
- **A hire only counts when it's confirmed.** *Our placement numbers are logged through the
  platform, never self-reported into a spreadsheet.*
- **Public profiles are redacted.** *No ID numbers, no documents, no contact details in search.
  Contact is revealed only to verified employers, with consent, and every reveal is logged where
  the seeker can see it.*
- **Location, never nationality.** *People are matched by where they are and what they can do.
  Nationality is shown, never a gate.*

---

## 5 · How it works

**Eyebrow:** How it works
**Heading:** One loop, from profile to policy
**Lead:** The hiring is the product. The analytics fall out of it honestly.

1. **A seeker builds one profile.** Skills, experience, availability, place. Free, in four
   languages, on any phone.
2. **Employers search or match.** Live filters by skill, province and availability, or
   reverse-matching against a specific vacancy.
3. **Roles reach people two ways.** The employer invites a seeker to a named role, or shares the
   vacancy's public Self Apply link anywhere, including WhatsApp, and seekers walk in themselves.
4. **Contact is revealed with consent.** Verified employers only. Audited every time. The seeker
   sees who reached them.
5. **The hire is confirmed.** Logged through the platform, so it counts once and counts true.
6. **The nation learns.** Confirmed hiring rolls up into k-anonymised analytics: demand, supply,
   shortages, outcomes. Live, not last year.

---

## 6 · Proof

**Eyebrow:** Proof
**Heading:** We'd rather show you the live numbers
**Lead:** These figures render straight from the register the moment you load this page. They are
the same numbers our own dashboards run on. Freshness-weighted, never inflated.

*(Build: three live stat tiles from `dataProvider.getAnalyticsSnapshot()`: Active profiles ·
Confirmed hires this month · Skills tracked. Same source as the landing pulse. Never hard-typed.)*

**Honest line:** Sebenza is young and we won't pretend otherwise. We don't invent five-star
quotes: as real people and employers say real things, their words appear here with their names
attached, and only with their consent.

*(Build: the consented `TestimonialsRail` renders here; it shows nothing until approved,
named quotes exist.)*

**What we can promise today:**
- Free for job seekers. No fees, ever, and no paying to rank higher.
- POPIA-first from the first line of code: granular consent, field-level encryption, a
  permanent audit log, export and erasure built in.
- Honest badges, honest freshness, honest placement counts. The register would rather look
  smaller than lie.
- Built for the real South Africa: a low-end Android on 3G is our reference device, four launch
  languages, installable like an app.

---

## 7 · Why Sebenza

**Eyebrow:** Why Sebenza
**Heading:** Why Sebenza, and not another job board

- **It's a register, not a pinboard.** Job boards list adverts. Sebenza maintains a living,
  freshness-weighted register of people, and roles come to them.
- **Trust is engineered, not claimed.** Verification states, consent gates, audited reveals and
  redaction are enforced in code, on every read.
- **The analytics nobody else has.** Because hires are confirmed in-platform, the aggregate
  picture is real: live shortage signals, placement outcomes, curriculum-versus-demand. All
  k-anonymised.
- **Hiring flows both directions.** Employers pull with search and invitations; seekers walk in
  through public Self Apply links shared anywhere. One pipeline, honestly labelled.
- **Your data stays yours.** Seekers can pause visibility, block an employer, export everything,
  or erase themselves. Consent is per-purpose, never a blanket tick-box.

---

## 8 · Pricing

**Eyebrow:** Pricing
**Heading:** Free for job seekers. Simple for everyone else.
**Lead:** A national register only works if every South African can afford to be on it, so the
seeker side is free, permanently. Employer and government partnerships are priced to the size of
the team and the reporting they need.

**CTA:** Talk to us about a partnership → `mailto:info@sebenzasa.com`

*(Build note: there is no self-serve billing in the product today; do not invent tiers or
numbers. When billing ships, prices render live, never hand-typed.)*

---

## 9 · Final CTA

**Heading:** See the register for yourself.
**Subhead:** Search it as a visitor, join it as a seeker, or write to us and we'll walk you
through the employer and analytics sides with your own use case in mind. No pressure, no jargon.
**Primary CTA:** Search talent → `/search`
**Secondary CTA:** Create a free profile → `/sign-up/seeker`
**Tertiary:** Talk to us → `mailto:info@sebenzasa.com`

---

## 10 · Footer *(shared `SiteFooter`)*

The standard site footer. No custom marketing footer: the legal surface (Privacy, PAIA, Terms,
Accessibility) is part of the pitch.

---

## Copy rules (keep these true as the page evolves)

- **Never name the incumbent registry or any competitor.** Sebenza stands on its own merits.
- **No em-dashes.** House punctuation: full stops, commas, colons, and the "·" separator.
- **Every number is live.** Stats render from `dataProvider`; nothing hard-typed, ever.
- **No fabricated testimonials, logos, or scarcity.** The testimonial rail stays empty until real,
  named, consented quotes exist.
- **Every claim maps to something shipped.** If the build can't back it, the page can't say it.
- **Button labels match what they do.** "Search talent" opens /search; "Create a free profile"
  opens sign-up; "Talk to us" opens email.
- **`info@sebenzasa.com` is live** (created 2026-08-15). All Talk-to-us mailtos point at it.
- **Two public story surfaces:** `/` is the visual, product-led landing; `/marketing` is this
  copy-led explainer. Keep them consistent; both are indexed with their own canonicals.
- **Free-for-seekers is a permanent promise** on this page; changing that is a product decision
  with its own review, not a copy edit.

---

## Build checklist

- [x] This copy doc (source of record).
- [x] `app/[locale]/(public)/marketing/page.tsx`: server component, Civic-Editorial, reuses
  `SiteHeader` + `TestimonialsRail` + `SiteFooter`, live stats from
  `dataProvider.getAnalyticsSnapshot()`.
- [x] Metadata: title + description + canonical/hreflang via `localeAlternates("/marketing")`;
  indexed (inherits the Phase 33 OG defaults for WhatsApp sharing).
- [x] Sitemap entry (priority 0.7).
- [x] Verify: typecheck + unit tests + production build + curl; screenshots for the founder.

*Sebenza · sebenzasa.com · South Africa · `/marketing` explainer funnel · source of record*

---

## 5b · The growth loop (added 2026-08-19, founder ask)

Placed directly after "How it works", on paper background, same numbered-list pattern
(brand-green numerals to distinguish it from the accent-ochre operational loop).
Catalog namespace: `marketing.growth.*` (en + zu/xh/af AI drafts pending human review).

**Eyebrow:** The growth loop
**Heading:** And for the seeker nobody has found yet
**Lead:** Sebenza doesn't just list you. It grows you  in one honest loop.

1. **Your Career compass reads real demand.** It watches what employers near you actually
   search and hire for, compares that with your skills, and names the gap worth closing first.
2. **You start a learning path.** Free and low-cost South African routes  SETA learnerships,
   TVET programmes, recognised online courses  matched to that exact gap.
3. **The new skill lands on your profile.** The moment you finish, it counts. No certificates
   to upload; your profile simply grows.
4. **Your ranking rises.** Search results favour the skills employers want. Learning the right
   thing moves you up  the compass even shows the projected jump before you start.
5. **An employer finds you.** That's the whole point: you become findable for work you can
   actually do. And when it turns into a hire, it's confirmed on the platform  truthfully
   counted.

