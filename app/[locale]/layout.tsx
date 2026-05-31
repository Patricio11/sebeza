import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { CookieConsentBanner } from "@/components/feature/legal/CookieConsentBanner";
import { readCookieConsent } from "@/lib/cookies/consent";
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
};

export const metadata: Metadata = {
  title: {
    default: "Sebenza  South African talent platform",
    template: "%s · Sebenza",
  },
  description:
    "Find skilled people near you. Get found for the work you do. POPIA-compliant, accessibility-first, freshness-weighted talent data for South Africa.",
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
      </body>
    </html>
  );
}
