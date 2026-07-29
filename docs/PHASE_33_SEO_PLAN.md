# PHASE 33 PLAN — FULL SEO + SOCIAL SHARING PASS ✅ COMPLETE

**Status: SHIPPED 2026-07-28.** All tasks 33.1–33.7 implemented as planned (no scope changes): `lib/seo.ts` + root `metadataBase`/OG/twitter/robots/verification, generated `/og-image` (lives under `app/[locale]/(public)/og-image/` because the i18n proxy rewrites unprefixed paths), share-card domain fixed, per-page metadata + hreflang everywhere public, consent-aware profile indexing (`isProfileIndexableQuery`, fails closed), Organization/WebSite/Person/FAQPage JSON-LD, landing FAQ, sitemap + robots fixes, noindex on all five private route groups (new `(auth)/layout.tsx`), Vercel Analytics + Speed Insights. Remaining work is the founder-side manual checklist (§VERIFY item 7): GSC/Bing verification env vars, sitemap submission, Vercel dashboard toggles, WhatsApp paste-test.

*Executes `docs/SEO_PLAYBOOK.md` end-to-end for Sebenza, adapted for a 4-locale national platform. Prompted by founder (2026-07-02): "work on SEO fully… remember the sharing as well, like when I send the link on WhatsApp." Runs alongside Phase 32 (security hardening).*

> **Thesis:** The platform's SEO is half-built: a good dynamic sitemap (consent-aware profiles!) and a rich `/p/[handle]` card, but **no `metadataBase`** (so OG image URLs are relative — WhatsApp requires absolute URLs, which is exactly the founder's broken-preview complaint), the share card hardcodes the WRONG domain (`sebenza.co.za`), landing/search/insights ship **no OG tags at all**, there is **zero JSON-LD** anywhere, no hreflang in HTML, sitemap canonicals self-redirect, and dashboards rely on robots.txt alone. A national platform whose entire seeker acquisition motion is organic + WhatsApp forwarding deserves the full pass.

---

## 📇 PLAYBOOK §1 INPUTS (filled from the codebase; founder can adjust any later)

| Input | Value | Source / note |
|---|---|---|
| `PRODUCTION_DOMAIN` | `sebenzasa.com` | Live domain (Phase 9.18 rename). |
| `BUSINESS_NAME` | `Sebenza` | Working name; brand everywhere. |
| `LEGAL_NAME` | `Yetotec (Pty) Ltd` | Phase 31 responsible party. |
| `TAGLINE_TITLE` | `South Africa's National Talent Platform` | Matches the hero's civic framing. |
| `META_DESCRIPTION` | "Find skilled people near you, or get found for the work you do. South Africa's POPIA-first talent platform — free for job seekers, honest by design." | ≤160 chars, both marketplace sides. |
| `PRIMARY_KEYWORDS` | `sebenza`, `south african talent platform`, `national talent platform south africa` | Brand + category. |
| `SECONDARY_KEYWORDS` | `find skilled workers south africa`, `hire staff south africa`, `get found for work south africa`, `job seekers south africa`, `skills register south africa` | Both sides of the marketplace. |
| `BUSINESS_ADDRESS` / `GEO` / `OPENING_HOURS` | **UNKNOWN — flagged, not blocking** | No public office address in the repo. LocalBusiness JSON-LD SKIPPED until founder supplies one (pure-online posture is fine per playbook §A5). |
| `SUPPORT_EMAIL` | `popia@sebenzasa.com` | The published contact. |
| `AREAS_SERVED` | `ZA` | National platform, SA-bounded by design. |
| `SOCIAL_PROFILES` | **UNKNOWN — flagged, not blocking** | `sameAs` ships empty; add when profiles exist. |
| `PUBLIC_ROUTES` | `/`, `/search`, `/insights`, `/privacy`, `/paia`, `/terms`, `/accessibility`, `/p/[handle]` | Sitemap currently MISSES `/terms` + `/accessibility`. |
| `PRIVATE_ROUTE_PREFIXES` | `/dashboard`, `/employer`, `/admin`, `/gov`, `/api`, all auth paths | Already in robots.ts, but unprefixed (localized `/zu/dashboard` uncovered). |
| `TRADEMARK_NOTICE` | none | No registered mark yet. |

---

## 📋 TASKS

### 33.1 Foundations — `lib/seo.ts` + root metadata + default OG image

- [x] **`lib/seo.ts`** (new): single source of truth — `SITE_URL` (`NEXT_PUBLIC_APP_URL ?? BETTER_AUTH_URL ?? "https://sebenzasa.com"`), brand constants, and `localeAlternates(path)` returning `{ canonical, languages }` honouring `localePrefix: "as-needed"` (en unprefixed; `/zu|/xh|/af` prefixed; `x-default` → en). Sitemap + robots + share card all migrate onto it so the domain lives in ONE place.
- [x] **Root layout (`app/[locale]/layout.tsx`)**: add `metadataBase` (THE WhatsApp fix — makes every OG URL absolute), full `openGraph` defaults (siteName, `locale: "en_ZA"`, type website, default image), `twitter: summary_large_image`, `robots` + `googleBot` block, `keywords`, `authors/creator/publisher`, `category: "employment"`, env-driven `verification` (Google + Bing). Existing PWA/title/icon config preserved.
- [x] **Default branded OG image** — instead of the playbook's "founder supplies `public/og.png`" manual step, generate it: new `app/og-image/route.tsx` (`next/og` `ImageResponse`, 1200×630, long revalidate) in the Civic-Editorial voice — paper background, SA-chevron motif, "Sebenza — South Africa's National Talent Platform", flag-band strip. Referenced from root `openGraph.images`. Landing, /search, /insights and legal pages all inherit it → WhatsApp previews everywhere.
- [x] **Fix the share card's hardcoded `sebenza.co.za`** → derive from `SITE_URL` (it's been rendering the wrong domain on every shared profile since Phase 11.4.1).

### 33.2 Per-page metadata + hreflang

- [x] **Landing**: `generateMetadata` — keyword-led title (overrides template), marketing description, `alternates` (canonical + hreflang via helper).
- [x] **/search**: extend the existing title-only `generateMetadata` with description, alternates, OG override ("Search N skilled South Africans" style static copy — no per-query indexing).
- [x] **/insights**: add `generateMetadata` (title, description, alternates) — the public analytics page is a genuine ranking asset ("south africa employment statistics").
- [x] **Legal pages** (privacy/paia/terms/accessibility): add canonical + hreflang alternates to the existing title/description.
- [x] **/p/[handle]** — two changes:
  1. hreflang alternates (same content across locales).
  2. **Consent-aware indexing (the Sebenza-flavoured magic):** profiles WITHOUT granted `searchability` consent get `robots: { index: false }`. Today every profile page says `index: true` regardless — aligning Google's reach with the seeker's own consent is a privacy IMPROVEMENT shipped inside an SEO phase. Consented profiles keep index+follow (being found is the point).

### 33.3 Structured data (JSON-LD)

- [x] **`components/seo/StructuredData.tsx`** (new, server-rendered):
  - `Organization` — Sebenza, `legalName` Yetotec (Pty) Ltd, logo, `contactPoint` (popia@…), `areaServed: ZA`, `sameAs: []` until profiles exist.
  - `WebSite` + `SearchAction` → `/search?q={search_term_string}` (Google sitelinks search box).
- [x] Mounted on the landing page.
- [x] **`Person` JSON-LD on `/p/[handle]`** — only when consented/indexable: name (already-redacted display name), `jobTitle`, `addressRegion` province, url. Strictly the fields the page already renders — Redaction Rule untouched.
- [x] BreadcrumbList: SKIPPED (flat IA, no benefit).

### 33.4 Landing FAQ + FAQPage JSON-LD

Six questions in the Civic-Editorial voice (accordion `<details>` styling, `#faq` anchor, section before the final CTA), each answer 2–4 plain-language sentences that are TRUE about the platform: What is Sebenza? · Is it free for job seekers? · How do employers find me? · Do I need matric or a degree to join? · How is my personal information protected? (POPIA, consent, encryption) · What does "verified" mean? (Verification-Honesty). Inline `FAQPage` JSON-LD next to the rendered HTML.

### 33.5 Sitemap + robots fixes

- [x] Sitemap: add missing `/terms` + `/accessibility`; **fix self-redirecting canonicals** (emit unprefixed URLs for `en` per `as-needed`); real `lastModified` for static routes via a maintained `CONTENT_UPDATED` constant instead of `new Date()`-always-now; migrate base URL to `lib/seo.ts`; keep the consented-profiles logic exactly as is (it's already right).
- [x] Robots: cover locale-prefixed private paths (`/zu/dashboard` etc.) by generating the disallow list × locale prefixes; migrate base URL.

### 33.6 noindex belt-and-braces

`robots: { index: false, follow: false }` metadata exported from the `(seeker)`, `(employer)`, `(admin)`, `(gov)` and auth-group layouts — today a leaked/linked dashboard URL relies on robots.txt alone, which prevents *crawling* but not *indexing* of the URL itself.

### 33.7 Analytics (playbook §C2)

`@vercel/analytics` + `@vercel/speed-insights` mounted in the root layout. Cookieless by design → consistent with the cookie banner's "no profile is built from your browsing" promise (the banner's optional-analytics wording already anticipated this). Dashboard toggles are the founder's manual step.

---

## 🚫 OUT OF SCOPE (playbook §8 + Sebenza specifics)

- ❌ GA4 / cookie-based analytics. ❌ Programmatic SEO landing pages (per-province/per-profession pages are a REAL future opportunity — "electricians in Gauteng" — but pSEO is its own phase with content-quality rules). ❌ Backlink outreach / Google Business Profile (manual, founder-side). ❌ A/B testing titles. ❌ LocalBusiness JSON-LD until a public address exists. ❌ Blog/content engine.

## 🧭 KEY DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | `metadataBase` + all URL building centralised in `lib/seo.ts`. | The wrong-domain share card proves scattered URL literals rot. One import, one truth. |
| D2 | Default OG image is GENERATED (`next/og` route), not a static PNG the founder must supply. | Removes the playbook's biggest manual blocker; Civic-Editorial branding comes from code we already have (share card proves the pattern). |
| D3 | Profile indexing follows `searchability` consent. | POPIA-First: Google's reach ≤ the seeker's own grant. Consented seekers WANT discovery; unconsented get noindex. |
| D4 | FAQ answers state only true platform facts, no marketing superlatives. | Playbook rule + the platform's honesty ethos are the same rule here. |
| D5 | Search/insights get static descriptions; no per-query pages indexed. | Query-parameter URLs in the index are crawl-budget noise; the pSEO route is a deliberate future phase. |

## 🧪 VERIFY

- [x] `npm run build` clean; `curl` rendered HTML: landing/search/insights/p-handle all emit absolute `og:image`, `og:site_name`, twitter card, canonical + 5 hreflang links (en/zu/xh/af/x-default).
- [x] Landing HTML contains 3 JSON-LD blocks (Organization, WebSite, FAQPage); consented profile contains Person; validator-clean structure.
- [x] `/sitemap.xml` includes terms+accessibility, no `/en/`-prefixed self-redirecting URLs; `/robots.txt` covers localized private paths.
- [x] `/og-image` returns a 1200×630 image; share card renders `sebenzasa.com`.
- [x] Unconsented profile (or seeded profile with searchability revoked) emits `noindex`; dashboard layouts emit `noindex`.
- [x] `test:all`-level: typecheck + vitest green.
- [ ] Post-deploy (founder manual): GSC verify via env var, submit sitemap, Bing import, Vercel Analytics toggle, WhatsApp-paste a landing + profile URL and see the branded card.
