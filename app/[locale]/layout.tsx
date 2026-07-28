import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieConsentBanner } from "@/components/feature/legal/CookieConsentBanner";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { readCookieConsent } from "@/lib/cookies/consent";
import {
  BRAND_NAME,
  LEGAL_NAME,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo";
import "../globals.css";

// Subset to latin (Tier 1 locales  en/zu/xh/af  all use latin).
// Tier 3 locales (esp. Tshivenda diacritics) extend this subset.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
});

export const viewport: Viewport = {
  themeColor: "#FAF8F4",
  width: "device-width",
  initialScale: 1,
  // Phase 28 (PWA)  extend the layout into the notch/home-indicator areas
  // so `env(safe-area-inset-*)` padding works when installed standalone.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // Phase 33  THE WhatsApp fix. Without metadataBase every relative
  // openGraph/twitter image URL fails to resolve to an absolute URL
  // (or resolves against the deployment URL rather than the canonical
  // domain), and WhatsApp/scrapers only render previews from absolute
  // URLs. All URL config lives in lib/seo.ts (D1).
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Sebenza",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: BRAND_NAME, url: SITE_URL }],
  creator: BRAND_NAME,
  publisher: LEGAL_NAME,
  category: "employment",
  // Phase 33  sitewide OpenGraph + Twitter defaults. Every public
  // page inherits these (and the generated /og-image card), so a
  // WhatsApp/LinkedIn/X share of ANY route unfurls branded. Pages
  // with richer cards (/p/[handle]) override images per-page.
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image"],
  },
  // Explicit sitewide default; private route-group layouts override
  // with index:false (Phase 33.6 belt to the robots.txt braces).
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
  // Env-driven search-console verification: set the env var in Vercel,
  // redeploy, click Verify  no code change when tokens rotate.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
  // Phase 28 (PWA)  installed-app identity. The manifest (app/manifest.ts)
  // carries the Android side; these cover iOS "Add to Home Screen".
  applicationName: "Sebenza",
  appleWebApp: {
    capable: true,
    title: "Sebenza",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const consent = await readCookieConsent();

  return (
    // Phase 11.5.8  explicit `dir="ltr"`. Every Tier-1/2/3 locale we
    // ship today is LTR; setting the attribute documents intent +
    // protects against a future RTL addition (Arabic, Persian) where
    // it becomes load-bearing. When RTL locales ship, switch this to
    // a `routing.localeDirection[locale]` lookup.
    <html
      lang={locale}
      dir="ltr"
      className={`${fraunces.variable} ${hanken.variable}`}
    >
      {/* suppressHydrationWarning on <body> absorbs the attribute spam
          some browser extensions (Bitdefender TrafficLight, Grammarly,
          LastPass) inject on the body element before React can hydrate
           e.g. bis_register, __processed_<uuid>__. Without this,
          every page load in dev surfaces a noisy hydration warning that
          isn't a code bug. The suppression only covers attribute
          mismatches on this exact element; real content mismatches
          (text nodes, child trees) still error normally. */}
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[color:var(--color-paper)] text-[color:var(--color-ink)]"
      >
        {/* Phase 11.5.7  skip-to-main link for keyboard users on public
            routes. DashboardShell already provides its own; this one
            lives in the root layout so /, /search, /p/{handle}, sign-in,
            POPIA pages all benefit. Visually hidden until focused. */}
        <a
          href="#main"
          className="sr-only absolute left-2 top-2 z-50 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] focus:not-sr-only focus:outline-none"
        >
          Skip to main content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          {/* Phase 9  cookie consent banner. Renders only when no
              choice has been made yet (consent.recordedAt === null). */}
          <CookieConsentBanner alreadyDecided={Boolean(consent.recordedAt)} />
        </NextIntlClientProvider>
        {/* Phase 28  offline-fallback service worker (production only). */}
        <ServiceWorkerRegistrar />
        {/* Phase 33  Vercel Analytics + Speed Insights. COOKIELESS by
            design (no cross-site tracking, no persistent identifier), so
            they sit outside the cookie-consent gate  consistent with
            the banner's "no profile is built from your browsing"
            promise. No-ops locally; activate with the dashboard toggles. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
