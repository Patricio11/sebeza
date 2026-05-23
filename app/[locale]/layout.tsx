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
    <html lang={locale} className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="min-h-screen bg-[color:var(--color-paper)] text-[color:var(--color-ink)]">
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
