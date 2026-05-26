# SEO Playbook - Drop-in Optimisation for Next.js Sites

> **How to use this in another project:** copy this file into the new repo's root, then prompt Claude:
> *"Read SEO_PLAYBOOK.md and execute it end-to-end for this project. Ask me only for the inputs in §1."*
> Claude does the code work; the **§5 Manual Steps** section is what you do yourself in browser tabs.

---

## 1. Inputs Claude needs from you (fill in once, reuse everywhere)

Before Claude starts, give these. Everything else is mechanical.

| Input | Example | Notes |
|---|---|---|
| `PRODUCTION_DOMAIN` | `seairo.com` | Bare domain, no `https://`, no trailing slash |
| `BUSINESS_NAME` | `Seairo Cargo` | The legal/displayed brand |
| `LEGAL_NAME` | `Seairo Cargo Solutions (Pty) Ltd` | For footer + Organization JSON-LD `legalName` |
| `TAGLINE_TITLE` | `Shared Reefer Services® for Cold-Chain Exporters` | Goes into `<title>` template, OG titles |
| `META_DESCRIPTION` | one tight sentence, ≤160 chars | Keyword-loaded but reads like a human wrote it |
| `PRIMARY_KEYWORDS` | `shared reefer services`, `seairo cargo` | The "must rank #1" terms (your brand + trademark) |
| `SECONDARY_KEYWORDS` | `consolidated reefer shipping cape town`, `cold chain LCL exporter` | Realistic targets, 5–10 phrases |
| `BUSINESS_ADDRESS` | locality / region / postal / country code | Drives LocalBusiness JSON-LD |
| `BUSINESS_GEO` | latitude, longitude | Pin on Google Maps for the same address |
| `OPENING_HOURS` | Mon–Fri 08:00–17:00 | LocalBusiness schema |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | `cat@seairocargo.co.za` / `+27-72-261-7325` | ContactPoint schemas |
| `AREAS_SERVED` | ISO country codes: `ZA, NL, GB, DE` | ContactPoint + Service schemas |
| `SOCIAL_PROFILES` (when live) | LinkedIn, X, etc. URLs | Goes into Organization `sameAs` |
| `PUBLIC_ROUTES` | `/`, `/blog`, `/services` | Pages that *should* appear in sitemap |
| `PRIVATE_ROUTE_PREFIXES` | `/admin`, `/dashboard`, `/api`, auth holding pages | Disallowed in robots.ts |
| `TRADEMARK_NOTICE` (if any) | `Shared Reefer Services® is a registered trademark of …` | Footer line + first-on-page use |

If any input is missing, Claude should flag it and keep building everything else - don't block on placeholders.

---

## 2. Mental model - what code can and can't do

**Two layers, only one is code:**

- **Technical + on-page (code, ≈1 day)** - metadata, structured data, sitemap, robots, OG image, keyword-tuned headings, FAQ schema, performance. Without this, Google can index but can't *understand* the page.
- **Off-page authority (months)** - backlinks, Google Business Profile, fresh content, social presence. No code creates this.

**Reality check** (paste this on the user's expectations):
- Branded / trademarked terms rank within days of indexing - there's no competition.
- Generic terms ("cold chain logistics", "SaaS analytics") will not rank in Q1 no matter how clean the code. Those need backlinks + content over time.
- The OG image and favicon set are the single highest-impact items for *human* perception when someone shares the URL. Treat them as launch blockers.

---

## 3. Stack assumption + dependencies

This playbook assumes **Next.js 14/15 App Router + TypeScript** deployed on **Vercel**. Adjust paths for `pages/` router if you must.

```bash
npm install @vercel/analytics @vercel/speed-insights
```

That's it for runtime deps. Everything else is built into Next.

---

## 4. Phase-by-phase code work

### Phase A - Technical foundations

#### A1. Root metadata in `app/layout.tsx`

Replace whatever's there with a full `Metadata` export. Pattern:

```ts
import type { Metadata, Viewport } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://PRODUCTION_DOMAIN";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: "BUSINESS_NAME - TAGLINE_TITLE",
        template: "%s | BUSINESS_NAME",
    },
    description: "META_DESCRIPTION",
    applicationName: "BUSINESS_NAME",
    keywords: [
        "PRIMARY_KEYWORD_1",
        "PRIMARY_KEYWORD_2",
        "SECONDARY_KEYWORD_1",
        // …all keywords from §1
    ],
    authors: [{ name: "BUSINESS_NAME", url: SITE_URL }],
    creator: "BUSINESS_NAME",
    publisher: "BUSINESS_NAME",
    alternates: { canonical: "/" },
    openGraph: {
        type: "website",
        locale: "en_ZA",        // ← change per market
        url: SITE_URL,
        siteName: "BUSINESS_NAME",
        title: "BUSINESS_NAME - TAGLINE_TITLE",
        description: "META_DESCRIPTION",
        images: [{
            url: "/og.png",
            width: 1200,
            height: 630,
            alt: "BUSINESS_NAME - TAGLINE_TITLE",
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: "BUSINESS_NAME - TAGLINE_TITLE",
        description: "META_DESCRIPTION",
        images: ["/og.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    icons: {
        icon: [
            { url: "/favicon.ico" },
            { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
    manifest: "/site.webmanifest",
    category: "logistics",      // ← change per industry
    verification: {
        google: process.env.GOOGLE_SITE_VERIFICATION,
        ...(process.env.BING_SITE_VERIFICATION
            ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
            : {}),
    },
};

export const viewport: Viewport = {
    themeColor: "#2563eb",      // ← brand colour
    colorScheme: "light dark",
    width: "device-width",
    initialScale: 1,
};
```

**Why each piece matters** - keep these comments in the code so future contributors don't strip them:
- `metadataBase` lets relative URLs in OG/Twitter resolve correctly.
- `title.template` auto-suffixes every child page (`%s | Business Name`).
- `googleBot` directives unlock larger image/snippet sizes in search results.
- `verification.google` is **env-driven** so you can verify post-deploy without a code change.

#### A2. Per-page metadata override (the home page)

Promote your trademark / hero phrase to the SERP title on the landing page only:

```ts
// app/page.tsx
export const metadata: Metadata = {
    title: "TRADEMARKED_PHRASE® | TAGLINE",
    description: "More marketing-y description that mentions the trademark and what you do.",
    alternates: { canonical: "/" },
};
```

Repeat per public route (`/services`, `/blog/[slug]`, etc.) - each gets its own keyword-tuned title and description.

#### A3. `app/sitemap.ts` (Next.js convention - no manual XML)

```ts
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://PRODUCTION_DOMAIN";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    return [
        { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
        // Add a row per public route. priority drops 0.1–0.2 per level of depth.
    ];
}
```

For dynamic routes (blog posts, etc.), fetch slugs from the DB/CMS in this function - it runs at build time *and* at request time on Vercel, so freshness is automatic.

#### A4. `app/robots.ts`

```ts
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://PRODUCTION_DOMAIN";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{
            userAgent: "*",
            allow: ["/"],
            disallow: [
                "/admin", "/admin/",
                "/dashboard", "/dashboard/",
                "/api/",
                // any auth holding routes (verify-email, post-login redirect):
                "/auth/onboarding", "/auth/verified", "/auth/forgot-password",
            ],
        }],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
```

**Critical** - disallow gated routes so Googlebot doesn't burn crawl budget on 401/403 responses. Replace the example list with whatever's behind login in your project.

#### A5. JSON-LD structured data

Create `components/seo/structured-data.tsx`. Three schemas, server-rendered so Googlebot reads them without executing JS:

- **Organization** - knowledge panel, contact points, sameAs links.
- **LocalBusiness** - physical address, geo coordinates, opening hours. Skip if pure online business.
- **Service** - describes the core offering, links to Organization via `@id`.

Reference template: see [components/seo/structured-data.tsx](components/seo/structured-data.tsx) in this repo. Adapt the constants - names, addresses, areaServed, contact details - to the new project. Wire it into the landing page:

```tsx
// app/page.tsx
import { StructuredData } from "@/components/seo/structured-data";

export default function HomePage() {
    return (
        <>
            <StructuredData />
            {/* ...rest of page */}
        </>
    );
}
```

Validate with [Schema.org Validator](https://validator.schema.org) and [Google's Rich Results Test](https://search.google.com/test/rich-results) once deployed.

---

### Phase B - Content / on-page keyword optimisation

This is where you trade abbreviations and clever-sounding copy for **the words customers actually type into Google**.

#### B1. Hero H1

The H1 is the single most-weighted on-page signal. It must contain your primary keyword phrase.

- Lead with the trademarked / branded term, in full, on first use of the page.
- Use `<sup>®</sup>` for the symbol so it doesn't dominate visually.
- Subhead reinforces the full phrase rather than an abbreviation. Don't write "SRS consolidation" if the keyword is "Shared Reefer Services consolidation".

#### B2. FAQ section + FAQPage JSON-LD

Add a FAQ section targeting **long-tail conversational queries** (what is X, how does X work, minimum order, vs alternative, etc.). Inline `FAQPage` JSON-LD next to the rendered HTML so Google can pull entries into:
- Rich results / "People Also Ask" carousel
- Featured snippets

Reference template: see [components/landing/faq-section.tsx](components/landing/faq-section.tsx) - accordion UI + JSON-LD inlined. Pattern:

```tsx
const FAQS = [
    { q: "Question phrased like a real search query?", a: "Answer that's a complete, standalone paragraph." },
    // 5–10 questions
];

const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
    })),
};

// In JSX:
<script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
```

**FAQ writing rules:**
- 5–10 entries. More than that dilutes ranking signal.
- Phrase questions exactly how a customer would type them - "what is", "how does", "do you", "what's the minimum".
- Answers are 2–4 sentences, complete on their own, naturally use the primary keyword once or twice.
- No marketing speak ("seamless", "best-in-class"). Plain English wins both with humans and with Google.

#### B3. Footer audit

- Brand description rewritten to lead with the trademarked phrase.
- Trademark notice line: *"X® is a registered trademark of Y."*
- Copyright year auto-updates: `© {BUSINESS_NAME} · {LOCATION} · {new Date().getFullYear()}`.
- Logo `alt` text expanded from "X" → "X - TAGLINE" so it gets picked up in image search.
- At least one internal anchor link to the FAQ (`href="#faq"`) - internal linking helps the FAQ section accumulate authority.

#### B4. Alt text audit on all hero/feature/testimonial images

Replace generic `alt="hero"` with descriptive alt text that includes a keyword where natural. Don't keyword-stuff - describe the image truthfully.

---

### Phase C - Tracking + verification (so you can measure progress)

#### C1. Env-driven verification meta tags

Already wired in §A1 via `metadata.verification`. The flow is:

1. User goes through manual GSC/Bing verification (see §5 below) and copies the verification token.
2. User sets `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` in Vercel env vars.
3. Redeploy. Next renders the meta tag. User clicks "Verify" in the search console.

No code change needed when the token rotates - just update the env var.

#### C2. Vercel Analytics + Speed Insights

In `app/layout.tsx`, mount the components in the `<body>`:

```tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning>
                {children}
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
```

- **Analytics** - page views, referrers, top pages. No cookies → no banner needed (privacy-first by default).
- **Speed Insights** - Core Web Vitals (LCP, CLS, INP) reported back per route. The signal that catches perf regressions before users complain.

Enable both in the Vercel dashboard's Analytics tab - until that toggle is on, no data shows even with the components mounted.

#### C3. (Optional) GA4 / Plausible / Fathom

Skip unless the user explicitly asks. Vercel's first-party analytics covers what most SaaS sites need without a cookie banner. Adding GA4 means a consent banner, more compliance work, and a heavier client bundle.

---

## 5. Manual steps the user must do (Claude can't do these)

Hand this list to the user when the code work is done.

### One-time, before launch

1. **Google Search Console** - visit [search.google.com/search-console](https://search.google.com/search-console), add the bare domain (`PRODUCTION_DOMAIN`), choose **HTML tag** verification method, copy the `content` value, set as `GOOGLE_SITE_VERIFICATION` in Vercel env, redeploy, click **Verify** in GSC.
2. **Submit sitemap in GSC** - Sitemaps → enter `sitemap.xml` → Submit. Google will start fetching `https://PRODUCTION_DOMAIN/sitemap.xml`.
3. **Bing Webmaster Tools** - [bing.com/webmasters](https://www.bing.com/webmasters). Easiest path: **Import from GSC** (one click). Otherwise manual XML/meta-tag verification using the same env-driven pattern - set `BING_SITE_VERIFICATION` and redeploy.
4. **Vercel Analytics** - Project → Analytics tab → enable. Same for Speed Insights.
5. **OG image** at `public/og.png` - 1200×630 PNG. A placeholder works for v1, but ship a branded design before the public launch. Without it, LinkedIn/Slack/X share previews are blank.
6. **Favicon set** - use [realfavicongenerator.net](https://realfavicongenerator.net), upload your logo, download the bundle, drop these in `public/`:
   - `favicon.ico` (Next auto-serves this)
   - `icon.svg` (vector, retina-friendly)
   - `apple-touch-icon.png` (180×180)
   - `site.webmanifest`
   The `icons` map in `metadata` already references these - once the files exist, the 404s in DevTools disappear automatically.
7. **Google Business Profile** (if local business) - [business.google.com](https://business.google.com). Verify the address. The address + geo in your LocalBusiness JSON-LD must match exactly.
8. **Set Vercel domain to canonical** - in Vercel, mark the bare apex (`PRODUCTION_DOMAIN`) as primary so `www.` 301s to it (or vice-versa, just pick one). Mixed canonicals tank rankings.

### Ongoing (no code involved)

9. **LinkedIn company page** - fill it in, post once a week minimum. The page becomes a `sameAs` link in your Organization schema and a strong ranking signal.
10. **Backlinks** - get yourself listed in industry directories, partner with one or two niche publications for a guest post. Generic terms only rank with backlinks.
11. **Quarterly content** - one substantial blog/case study per quarter, targeting one secondary keyword each. Add the slug to the sitemap.
12. **Quarterly audit** - run a [Lighthouse](https://pagespeed.web.dev) report on the landing page. SEO score should stay ≥95. Vercel Speed Insights surfaces regressions in between audits.

---

## 6. Files Claude creates / modifies

| File | New? | Purpose |
|---|---|---|
| `app/layout.tsx` | modify | root metadata + viewport + Analytics mount |
| `app/page.tsx` | modify | landing-specific metadata override + StructuredData wiring |
| `app/sitemap.ts` | new | sitemap generator |
| `app/robots.ts` | new | robots policy |
| `components/seo/structured-data.tsx` | new | Organization + LocalBusiness + Service JSON-LD |
| `components/landing/faq-section.tsx` | new | FAQ accordion + FAQPage JSON-LD |
| `components/landing/footer.tsx` | modify | trademark notice + alt-text + auto-year + FAQ anchor |
| `components/landing/hero-section.tsx` (or whatever your H1 lives in) | modify | keyword-led H1 |
| `package.json` | modify | adds `@vercel/analytics` + `@vercel/speed-insights` |
| `public/og.png` | manual | the user supplies this |
| `public/icon.svg`, `apple-touch-icon.png`, `site.webmanifest` | manual | favicon set |

---

## 7. Verification checklist (run after deploy)

After the user has done the manual steps and redeployed, Claude (or the user) should walk this list:

- [ ] `https://PRODUCTION_DOMAIN/sitemap.xml` returns valid XML with all public routes
- [ ] `https://PRODUCTION_DOMAIN/robots.txt` shows the disallow rules + sitemap pointer
- [ ] `view-source:` on the landing page shows the three+ JSON-LD `<script>` blocks (Org, LocalBusiness, Service, FAQPage)
- [ ] Paste the home URL into [Schema.org Validator](https://validator.schema.org) - zero errors
- [ ] Paste the home URL into [Google Rich Results Test](https://search.google.com/test/rich-results) - at least FAQ rich result detected
- [ ] [Lighthouse SEO score](https://pagespeed.web.dev) ≥ 95
- [ ] OG image preview works in [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and [X Card Validator](https://cards-dev.twitter.com/validator) (if it's still up - otherwise just paste the URL into a draft post and check the unfurl)
- [ ] DevTools → Network: `/og.png`, `/favicon.ico`, `/icon.svg`, `/apple-touch-icon.png`, `/site.webmanifest` all 200 (no 404 noise)
- [ ] GSC Coverage report: home URL marked as **Indexed** (takes 1–7 days after sitemap submit)
- [ ] Search the trademarked term in Google → your site is #1 (takes a few days post-indexing)

---

## 7b. Future SEO target - public CBM Calculator landing

After the CBM rollout (see [CBM_CARGO_TYPE.md](CBM_CARGO_TYPE.md)) we
ship a logged-in CBM calculator at `/dashboard/tools/cbm-calculator`.
A public, marketing-friendly version of the same calculator is a high-
intent SEO opportunity. Filed here so it doesn't get lost.

**Target queries** (high-intent, low-competition in our region):
- `cbm calculator south africa`
- `shared container cbm`
- `lcl cbm calculator`
- `cargo volume calculator south africa`
- `chargeable weight calculator sea freight`
- `cube vs pallet container loading`

**Why this is worth doing**:
- The calculator is *the* gateway tool exporters reach for. Bring them to
  it for free, then convert via "Quote this on the SRS network" + "Sign
  up to save calculations".
- Generic calculators on the web (pier2pier, cbm3.net) outrank us today
  for the volume-only queries because they have the topical authority.
  Our differentiator - live carrier rates + actual containers on the
  client's lane - only shows up *after* sign-in. A public version
  surfaces that differentiator earlier.

**Scope when we get to it** (separate phase, not part of this playbook's
core execution):
- New public route at `/tools/cbm-calculator` (server component) reusing
  `<CBMCalculator>` and `<CBM3DViz>` in read-only-savings mode
  (calculation persists to localStorage, not the DB).
- Inline "Sign in to save this" + "Get a real quote on the SRS network"
  CTAs at strong scroll positions.
- Page-level metadata + FAQPage JSON-LD targeting the queries above.
- Sitemap entry; expected indexable within a week of launch.
- No paywalled features below the fold - Google will deprioritise a
  page that locks the substance behind auth.

**Out of scope for this future phase**:
- Bulk paste / CSV upload (auth-only - they leave PII traces).
- Saved-calculation library (auth-only by design).
- Sharing-by-link from the public page (would require an unauth share
  token table; the logged-in flow already has one).

---

## 8. What this playbook deliberately does NOT do

- **No GA4 / Plausible / Fathom integration** - Vercel Analytics covers it without a cookie banner. Add only if the user explicitly asks.
- **No automated meta-description generation per page** - handcraft these. ML-generated meta descriptions tank CTR.
- **No prebuilding hundreds of programmatic SEO landing pages** - that's a separate, much larger initiative ("pSEO") with different rules around content quality and indexing limits.
- **No backlink outreach automation** - this lives off-platform and is the user's job. Code can't fake authority.
- **No A/B testing of titles/descriptions** - possible but high-effort; defer until a baseline is ranking.

If the user asks for any of these later, plan them as separate phases - don't fold into the playbook execution.
