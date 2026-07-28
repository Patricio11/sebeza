/**
 * Phase 33  the single source of truth for SEO / social-sharing
 * config (docs/PHASE_33_SEO_PLAN.md, executing docs/SEO_PLAYBOOK.md).
 *
 * WHY ONE MODULE (D1): before this phase the canonical domain lived in
 * four places  sitemap.ts + robots.ts read BETTER_AUTH_URL, the
 * profile share card HARDCODED the wrong domain (sebenza.co.za), and
 * the root layout had no metadataBase at all, which left every
 * OpenGraph image URL relative. WhatsApp (and most scrapers) only
 * render previews from ABSOLUTE image URLs  that missing
 * metadataBase was the founder's "no preview when I share the link"
 * bug. Everything URL-shaped now imports from here.
 *
 * No "server-only" pin: these are public constants + pure helpers,
 * safe (and needed) in metadata routes, RSC pages, and edge runtimes.
 */

import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

/**
 * Canonical origin, no trailing slash. Env override order:
 *   NEXT_PUBLIC_APP_URL  explicit choice (set this in prod)
 *   BETTER_AUTH_URL      already required for auth; usually correct
 *   fallback             the live production domain
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.BETTER_AUTH_URL ??
  "https://sebenzasa.com"
).replace(/\/$/, "");

/** Bare host for display contexts (e.g. the share-card footer). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export const BRAND_NAME = "Sebenza";
export const LEGAL_NAME = "Yetotec (Pty) Ltd";
export const TAGLINE = "South Africa's National Talent Platform";
export const SITE_TITLE = `${BRAND_NAME}  ${TAGLINE}`;
export const SITE_DESCRIPTION =
  "Find skilled people near you, or get found for the work you do. South Africa's POPIA-first talent platform  free for job seekers, honest by design.";
export const SUPPORT_EMAIL = "popia@sebenzasa.com";

/**
 * Keyword set from the Phase 33 plan's §1 inputs. Covers both sides
 * of the marketplace. The `keywords` meta tag is a weak signal on its
 * own  the real ranking work is titles/H1s/FAQ  but it costs
 * nothing and Bing still reads it.
 */
export const SITE_KEYWORDS = [
  "sebenza",
  "south african talent platform",
  "national talent platform south africa",
  "find skilled workers south africa",
  "hire staff south africa",
  "get found for work south africa",
  "job seekers south africa",
  "skills register south africa",
];

/**
 * Public-route path for a locale, honouring next-intl's
 * `localePrefix: "as-needed"`: the default locale (en) is UNPREFIXED;
 * the rest carry their prefix. Emitting `/en/...` URLs anywhere
 * user-visible causes a self-inflicted 307 from the i18n proxy
 * exactly the bug the pre-Phase-33 sitemap shipped.
 */
export function localePath(locale: AppLocale, path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  if (locale === routing.defaultLocale) return clean === "" ? "/" : clean;
  return `/${locale}${clean}`;
}

/** Absolute URL for a locale + path. */
export function localeUrl(locale: AppLocale, path: string): string {
  const p = localePath(locale, path);
  return p === "/" ? SITE_URL : `${SITE_URL}${p}`;
}

/**
 * Next Metadata `alternates` block for a public path: canonical (the
 * en/unprefixed form) + one hreflang per locale + x-default. Locale
 * codes use the bare language tags the catalogues use; Google accepts
 * both bare-language and language-region forms.
 *
 * Usage in a page/generateMetadata:
 *   alternates: localeAlternates("/search")
 */
export function localeAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localeUrl(locale, path);
  }
  languages["x-default"] = localeUrl(routing.defaultLocale, path);
  return {
    canonical: localeUrl(routing.defaultLocale, path),
    languages,
  };
}
