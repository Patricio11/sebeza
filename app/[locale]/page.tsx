import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localeAlternates, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import {
  FaqJsonLd,
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/seo/StructuredData";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchBar } from "@/components/feature/SearchBar";
import { SAChevron } from "@/components/ui/SAChevron";
import { AnimatedCount } from "@/components/feature/AnimatedCount";
import { dataProvider } from "@/lib/data/provider";
import { overallFreshnessConfidence } from "@/lib/mock/analytics";
import { getLandingTrends, type LandingTrends } from "@/db/queries/landing";
import { getProfessions, type TaxonomyOption } from "@/lib/taxonomy/query";
import { TestimonialsRail } from "@/components/feature/TestimonialsRail";
import { ArrowUpRight, MapPin, Clock, Sparkles, Quote } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Landing page  Mzansi National.
//
// A national platform asks for a national-feeling landing. Inspired by the SA
// flag without ever literally rendering it: deep flag-green primary, SA-gold
// accent, an abstracted Y-chevron as the structural mark, charcoal + cream
// for surface and text.
//
// Composition is deliberately editorial-asymmetric  never centered SaaS hero,
// never card-grid feature blocks. Motion is reserved: a one-time stagger on
// the hero text, count-up numerals on the pulse strip, and the chevron's
// hairline drawing in. All else is still.
//
// This is the landing only  `SiteHeader`/styling on every other page stays
// untouched until you approve, so you can review side-by-side.
// ─────────────────────────────────────────────────────────────────────────────

// Phase 33  the landing owns the brand title verbatim (absolute, no
// "%s · Sebenza" template) plus canonical + hreflang for the four
// launch locales. OG/twitter inherit the root defaults (/og-image).
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: localeAlternates("/"),
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  // Phase 23.2  real MoM trends computed from the DB (null = no baseline →
  // the chip hides). Never hardcoded.
  const [analytics, trends, professions] = await Promise.all([
    dataProvider.getAnalyticsSnapshot(),
    getLandingTrends(),
    getProfessions(),
  ]);
  const confidence = overallFreshnessConfidence(analytics);

  // The FAQ strings feed BOTH the visible accordion and the FAQPage
  // JSON-LD, from the catalog, so the two can never drift.
  const faqItems = ([1, 2, 3, 4, 5, 6] as const).map((i) => ({
    question: t(`faq.q${i}`),
    answer: t(`faq.a${i}`),
  }));

  return (
    <div className="bg-[color:var(--color-sa-cream)] text-[color:var(--color-sa-charcoal)]">
      {/* Phase 33  structured data: who we are, that the site is
          searchable (sitelinks search box), and the FAQ below. */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <FaqJsonLd items={faqItems} />
      <LandingHeader />
      <main id="main">
        <Hero
          t={t}
          analytics={analytics}
          confidence={confidence}
          locale={locale}
          trends={trends}
          professions={professions}
        />
        <PulseStrip t={t} analytics={analytics} confidence={confidence} locale={locale} />
        <Principles t={t} />
        <Pillars t={t} />
        {/* Phase 24  REAL, admin-curated, consented testimonials (replaces the
            fabricated cards 23.2 removed; renders nothing until any are
            approved). */}
        <TestimonialsRail />
        <DualSplit t={t} />
        <FAQ t={t} items={faqItems} />
        <FinalCTA t={t} />
      </main>
      <SiteFooter />
    </div>
  );
}

type LandingT = Awaited<ReturnType<typeof getTranslations<"landing">>>;

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

async function Hero({
  t,
  analytics,
  confidence,
  locale,
  trends,
  professions,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"landing">>>;
  analytics: Awaited<ReturnType<typeof dataProvider.getAnalyticsSnapshot>>;
  confidence: number;
  locale: string;
  trends: LandingTrends;
  professions: TaxonomyOption[];
}) {
  const nfmt = new Intl.NumberFormat(locale);
  const currentMonth = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(),
  );

  return (
    <section
      aria-label="Hero"
      className="relative overflow-hidden bg-[color:var(--color-sa-cream)] pt-28 pb-20 md:min-h-[88vh] md:pt-36 md:pb-28"
    >
      {/* Oversized chevron motif. On desktop it anchors the right side; on
          mobile it sits behind the dossier card at lower opacity so the
          signature mark travels to the most-important target device. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-12 z-0 h-[58%] w-[110%] opacity-[0.35] sm:h-[68%] sm:opacity-[0.6] md:right-[-8%] md:top-0 md:h-full md:w-[58%] md:opacity-[0.85]"
      >
        <SAChevron variant="signature" className="h-full w-full anim-fade anim-delay-5" />
      </div>

      {/* Subtle horizontal flag-banded divider at the very top of the hero */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 anim-fade"
      >
        <div className="flex h-full">
          <div className="flex-[3] bg-[color:var(--color-sa-green)]" />
          <div className="flex-[2] bg-[color:var(--color-sa-gold)]" />
          <div className="flex-[1] bg-[color:var(--color-sa-red)]" />
        </div>
      </div>

      {/* Phase 13.9 follow-up  mobile horizontal overflow fix.
          `gap-8` on `grid-cols-12` creates 11 × 32px = 352px of
          horizontal gap track space, which exceeds the content
          width on phones < ~400px. The `col-span-12` children then
          compute wider than the container and overflow to the right
          (the "search form shifted right" symptom).
          Switching to `gap-y-12 gap-x-0` on mobile + `md:gap-8` on
          desktop keeps the vertical rhythm between the headline
          column + dossier aside while neutralising the horizontal
          gap on the single-column mobile layout. */}
      <div className="relative mx-auto grid max-w-[1320px] grid-cols-12 gap-y-12 gap-x-0 px-5 md:gap-8 md:px-10">
        {/* Content column */}
        <div className="col-span-12 md:col-span-7">
          {/* Eyebrow */}
          <div className="anim-rise anim-delay-1 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
            <SAChevron variant="mark" className="size-3" />
            {t("hero.eyebrow")}
            <span
              aria-hidden="true"
              className="ml-1 inline-block h-px w-10 bg-[color:var(--color-sa-charcoal)]"
            />
          </div>

          {/* Headline  broken on purpose, last line italic in gold */}
          <h1 className="mt-7 font-display text-[color:var(--color-sa-charcoal)]">
            <span className="anim-rise-soft anim-delay-2 block leading-[0.95] tracking-[-0.025em] text-[clamp(2.25rem,9vw,7.2rem)]">
              {t("hero.h1a")}
            </span>
            <span className="anim-rise-soft anim-delay-3 block leading-[0.95] tracking-[-0.025em] text-[clamp(2.25rem,9vw,7.2rem)]">
              {t("hero.h1b")}
            </span>
            <span className="anim-rise-soft anim-delay-4 block leading-[0.95] tracking-[-0.025em] text-[clamp(2.25rem,9vw,7.2rem)]">
              <span className="italic font-light text-[color:var(--color-sa-gold-deep)]">
                {t("hero.h1cItalic")}
              </span>{" "}
              <span className="text-[color:var(--color-sa-green-deep)]">
                {t("hero.h1cRest")}
              </span>
            </span>
          </h1>

          <p className="anim-rise-soft anim-delay-5 mt-7 max-w-xl text-lg leading-relaxed text-[color:var(--color-ink-soft)] md:text-xl">
            {t("hero.subhead")}
          </p>

          {/* Search */}
          <div className="anim-rise-soft anim-delay-6 mt-9 max-w-2xl">
            <SearchBar variant="hero" professionOptions={professions} />
          </div>

          {/* Popular chips */}
          <div className="anim-fade anim-delay-7 mt-5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
            <span className="uppercase tracking-[0.22em] text-[color:var(--color-sa-green-deep)]">
              {t("search.recentChips")}
            </span>
            {[
              [t("chips.chefs"), t("chips.capeTown"), "chef", "western-cape"],
              [t("chips.developers"), t("chips.johannesburg"), "developer", "gauteng"],
              [t("chips.electricians"), t("chips.pretoria"), "electrician", "gauteng"],
              [t("chips.nurses"), t("chips.durban"), "nurse", "kwazulu-natal"],
            ].map(([role, city, q, p]) => (
              <Link
                key={role}
                href={{ pathname: "/search", query: { q: q!, province: p! } }}
                className="rounded-full border border-[color:var(--color-sa-charcoal)]/15 bg-white/80 px-3.5 py-1.5 transition-all hover:border-[color:var(--color-sa-green)] hover:text-[color:var(--color-sa-green-deep)]"
              >
                {role} · {city}
              </Link>
            ))}
          </div>
        </div>

        {/* Right column  floating "live national pulse" mini-dossier */}
        <aside className="anim-rise-soft anim-delay-6 col-span-12 mt-12 md:col-span-5 md:mt-0">
          <div className="relative md:translate-y-32 lg:translate-y-44">
            <div className="relative rounded-2xl border border-[color:var(--color-sa-charcoal)]/10 bg-white p-7 shadow-press md:p-8">
              {/* Tiny banded flag mark inside the card */}
              <div className="absolute -top-px left-7 right-7 flex h-[3px]">
                <div className="flex-[3] bg-[color:var(--color-sa-green)]" />
                <div className="flex-[2] bg-[color:var(--color-sa-gold)]" />
                <div className="flex-[1] bg-[color:var(--color-sa-red)]" />
              </div>

              <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-sa-green-deep)]">
                <span
                  aria-hidden="true"
                  className="relative inline-flex size-2"
                >
                  <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[color:var(--color-sa-green)] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[color:var(--color-sa-green)]" />
                </span>
                {t("dossier.live")}
              </div>

              <h2 className="mt-2 font-display text-2xl leading-tight">
                {t("dossier.today")}
              </h2>

              <dl className="mt-6 space-y-4">
                <DossierStat
                  label={t("dossier.activeProfiles")}
                  value={
                    <AnimatedCount
                      value={analytics.totalActive}
                      locale={locale}
                      className="font-display tabular text-3xl"
                    />
                  }
                  trend={trends.activesTrend ?? undefined}
                />
                <DossierStat
                  label={t("dossier.confirmedHires", { month: currentMonth })}
                  value={
                    <AnimatedCount
                      value={analytics.confirmedHiresThisMonth}
                      locale={locale}
                      className="font-display tabular text-3xl"
                    />
                  }
                  trend={trends.hiresTrend ?? undefined}
                />
                <DossierStat
                  label={t("dossier.trackedSkills")}
                  value={
                    <span className="font-display tabular text-3xl">
                      {analytics.demandBySkill.length}
                    </span>
                  }
                />
              </dl>

              <div className="mt-6 rounded-xl bg-[color:var(--color-sa-green-tint)] p-4">
                <div className="flex items-baseline justify-between text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-sa-green-deep)]">
                  <span>{t("dossier.freshnessConfidence")}</span>
                  <AnimatedCount
                    value={Math.round(confidence * 100)}
                    locale={locale}
                    suffix="%"
                    className="font-display tabular text-base text-[color:var(--color-sa-green-deep)]"
                  />
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/60">
                  <div
                    className="h-full bg-[color:var(--color-sa-green)]"
                    style={{
                      width: `${Math.round(confidence * 100)}%`,
                      transition: "width 1200ms cubic-bezier(0.4,0,0.2,1) 600ms",
                    }}
                  />
                </div>
                <p className="mt-2 text-[0.7rem] leading-snug text-[color:var(--color-sa-green-deep)]/85">
                  {t("dossier.freshnessBody")}
                </p>
              </div>

              <Link
                href="/insights"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-sa-green-deep)] hover:underline"
              >
                {t("dossier.insightsLink")}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Soft platform shadow under the card */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-8 -bottom-4 -z-10 h-12 rounded-full bg-[color:var(--color-sa-charcoal)] blur-3xl opacity-10"
            />
          </div>
        </aside>
      </div>

      {/* Scroll cue */}
      <div className="anim-fade anim-delay-7 absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-[0.62rem] uppercase tracking-[0.32em] text-[color:var(--color-ink-soft)] md:block">
        {t("hero.scrollCue")}
      </div>
    </section>
  );
}

function DossierStat({
  label,
  value,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[color:var(--color-sa-charcoal)]/15 pb-3 last:border-0 last:pb-0">
      <dt className="text-[0.78rem] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="flex items-baseline gap-3">
        {trend && (
          <span className="text-[0.68rem] uppercase tracking-[0.2em] text-[color:var(--color-sa-green)]">
            {trend}
          </span>
        )}
        {value}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PULSE STRIP  the high-contrast moment
// ─────────────────────────────────────────────────────────────────────────────

async function PulseStrip({
  t,
  analytics,
  confidence,
  locale,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"landing">>>;
  analytics: Awaited<ReturnType<typeof dataProvider.getAnalyticsSnapshot>>;
  confidence: number;
  locale: string;
}) {
  const currentMonth = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(),
  );
  const { lmiWithTrend } = await import("@/lib/analytics/lmi");
  const lmi = await lmiWithTrend();
  const lmiDelta = lmi.previous
    ? lmi.current.value - lmi.previous.value
    : null;
  return (
    <section
      aria-labelledby="pulse-h"
      className="grain-overlay relative overflow-hidden bg-[color:var(--color-sa-green-deep)] text-[color:var(--color-sa-cream)]"
    >
      {/* Gold underline at top, deep stripe  a band echoing the flag */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[color:var(--color-sa-gold)]" />

      <div className="relative mx-auto max-w-[1320px] px-5 py-20 md:px-10 md:py-28">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-gold)]">
              <SAChevron variant="mark" className="size-3" />
              {t("pulse.bulletin")} · {new Date().toISOString().slice(0, 10)}
              <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-sa-gold)]/40 px-2 py-0.5 text-[0.6rem] normal-case tracking-normal text-[color:var(--color-sa-cream)]/90">
                Sebenza LMI{" "}
                <span className="font-mono tabular text-[color:var(--color-sa-gold)]">
                  {lmi.current.value.toFixed(2)}
                </span>
                {lmiDelta != null && (
                  <span
                    className={
                      "ml-1 " +
                      (lmiDelta > 0
                        ? "text-[color:var(--color-sa-gold)]"
                        : lmiDelta < 0
                          ? "text-[color:var(--color-sa-red)]"
                          : "text-[color:var(--color-sa-cream)]/70")
                    }
                  >
                    ({lmiDelta > 0 ? "+" : ""}
                    {lmiDelta.toFixed(2)})
                  </span>
                )}
              </span>
            </div>
            <h2
              id="pulse-h"
              className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.02em]"
            >
              {t("pulse.h2a")}{" "}
              <span className="italic text-[color:var(--color-sa-gold)]">
                {t("pulse.h2bItalic")}
              </span>{" "}
              {t("pulse.h2c")}
            </h2>
          </div>
          <p className="max-w-sm text-[color:var(--color-sa-cream)]/80">
            {t("pulse.lead")}
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-[color:var(--color-sa-green)]/40 md:grid-cols-3">
          <BigStat
            label={t("pulse.statActive")}
            value={
              <AnimatedCount
                value={analytics.totalActive}
                locale={locale}
                className="font-display tabular text-[clamp(3.2rem,6vw,5.2rem)] leading-none"
              />
            }
            spark={analytics.trend.map((m) => m.registrations)}
            footnote={t("pulse.footConfidence", { percent: Math.round(confidence * 100) })}
            iconRight={<MapPin className="size-4" aria-hidden="true" />}
          />
          <BigStat
            label={t("pulse.statHires", { month: currentMonth })}
            value={
              <AnimatedCount
                value={analytics.confirmedHiresThisMonth}
                locale={locale}
                className="font-display tabular text-[clamp(3.2rem,6vw,5.2rem)] leading-none"
              />
            }
            spark={analytics.trend.map((m) => m.placements)}
            footnote={t("pulse.footLogged")}
            iconRight={<Clock className="size-4" aria-hidden="true" />}
            accent
          />
          <BigStat
            label={t("pulse.statSkills")}
            value={
              <span className="font-display tabular text-[clamp(3.2rem,6vw,5.2rem)] leading-none">
                {analytics.demandBySkill.length}
              </span>
            }
            footnote={t("pulse.footProvinces")}
            iconRight={<Sparkles className="size-4" aria-hidden="true" />}
          />
        </div>
      </div>
    </section>
  );
}

function BigStat({
  label,
  value,
  spark,
  footnote,
  iconRight,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  spark?: number[];
  footnote: string;
  iconRight: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-[color:var(--color-sa-green-deep)] p-7 md:p-10">
      <div
        className={
          "flex items-center justify-between text-[0.7rem] uppercase tracking-[0.24em] " +
          (accent
            ? "text-[color:var(--color-sa-gold)]"
            : "text-[color:var(--color-sa-cream)]/65")
        }
      >
        <span>{label}</span>
        <span aria-hidden="true">{iconRight}</span>
      </div>

      <div
        className={
          "mt-4 " +
          (accent
            ? "text-[color:var(--color-sa-gold)]"
            : "text-[color:var(--color-sa-cream)]")
        }
      >
        {value}
      </div>

      {spark && spark.length > 1 && (
        <svg
          width={140}
          height={36}
          viewBox={`0 0 140 36`}
          className="mt-5 anim-draw anim-delay-5"
          style={{ "--draw-length": "400" } as React.CSSProperties}
          aria-hidden="true"
        >
          <polyline
            fill="none"
            stroke={accent ? "var(--color-sa-gold)" : "var(--color-sa-cream)"}
            strokeWidth={1.5}
            opacity={0.85}
            points={spark
              .map((v, i) => {
                const max = Math.max(...spark);
                const min = Math.min(...spark);
                const range = max - min || 1;
                const x = (i / (spark.length - 1)) * 140;
                const y = 36 - ((v - min) / range) * 32 - 2;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ")}
          />
        </svg>
      )}

      <p className="mt-4 text-xs text-[color:var(--color-sa-cream)]/65">
        {footnote}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPLES  what Sebenza commits to, in its own voice
// ─────────────────────────────────────────────────────────────────────────────

function Principles({ t }: { t: LandingT }) {
  const principles = ([1, 2, 3, 4] as const).map((i) => ({
    dimension: t(`principles.d${i}`),
    commitment: t(`principles.c${i}`),
  }));
  return (
    <section
      aria-labelledby="prin-h"
      className="bg-[color:var(--color-sa-cream)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <header className="mb-12 md:mb-16">
          <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
            <SAChevron variant="mark" className="size-3" />
            {t("principles.eyebrow")}
          </div>
          <h2
            id="prin-h"
            className="mt-3 max-w-3xl font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
          >
            {t("principles.h2a")}
            <br />
            <span className="italic text-[color:var(--color-sa-green-deep)]">
              {t("principles.h2bItalic")}
            </span>{" "}
            {t("principles.h2c")}
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--color-ink-soft)]">
            {t("principles.lead")}
          </p>
        </header>

        <ol className="grid gap-px overflow-hidden rounded-2xl bg-[color:var(--color-sa-charcoal)]/10 md:grid-cols-2">
          {principles.map((p, i) => (
            <li
              key={p.dimension}
              className="group flex flex-col gap-3 bg-[color:var(--color-sa-cream)] p-7 transition-colors hover:bg-[color:var(--color-sa-green-tint)] md:p-10"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[2.4rem] italic leading-none text-[color:var(--color-sa-gold-deep)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="text-[0.66rem] uppercase tracking-[0.24em] text-[color:var(--color-sa-green-deep)]">
                  {p.dimension}
                </div>
              </div>
              <p className="font-display text-xl leading-snug text-[color:var(--color-sa-charcoal)] md:text-2xl">
                {p.commitment}
              </p>
            </li>
          ))}
        </ol>

        {/* Pull quote */}
        <blockquote className="mt-16 max-w-3xl border-l-4 border-[color:var(--color-sa-gold)] pl-6 md:mt-20">
          <Quote
            className="mb-3 size-5 text-[color:var(--color-sa-green-deep)]"
            aria-hidden="true"
          />
          <p className="font-display text-2xl italic leading-snug text-[color:var(--color-sa-charcoal)] md:text-3xl">
            {t("principles.quote")}
          </p>
          <cite className="mt-3 block text-[0.72rem] uppercase not-italic tracking-[0.24em] text-[color:var(--color-ink-soft)]">
            {t("principles.cite")}
          </cite>
        </blockquote>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PILLARS  three commitments that define the platform
// ─────────────────────────────────────────────────────────────────────────────

function Pillars({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"landing">>>;
}) {
  const pillars = [
    {
      n: "01",
      title: t("valueCards.trusted.title"),
      body: t("valueCards.trusted.body"),
      tint: "var(--color-sa-green-tint)",
      accent: "var(--color-sa-green-deep)",
    },
    {
      n: "02",
      title: t("valueCards.live.title"),
      body: t("valueCards.live.body"),
      tint: "var(--color-sa-gold-tint)",
      accent: "var(--color-sa-gold-deep)",
    },
    {
      n: "03",
      title: t("valueCards.real.title"),
      body: t("valueCards.real.body"),
      tint: "var(--color-sa-cream)",
      accent: "var(--color-sa-charcoal)",
    },
  ];

  return (
    <section
      aria-labelledby="pillars-h"
      className="bg-[color:var(--color-sa-charcoal)] py-20 text-[color:var(--color-sa-cream)] md:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <header className="mb-12 max-w-3xl md:mb-16">
          <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-gold)]">
            <SAChevron variant="mark" className="size-3" />
            {t("pillarsHeader.eyebrow")}
          </div>
          <h2
            id="pillars-h"
            className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
          >
            {t("pillarsHeader.h2a")}{" "}
            <span className="italic text-[color:var(--color-sa-gold)]">
              {t("pillarsHeader.h2bItalic")}
            </span>
            .
          </h2>
        </header>

        <div className="grid gap-px overflow-hidden rounded-2xl bg-[color:var(--color-sa-cream)]/10 md:grid-cols-3">
          {pillars.map((p) => (
            <article
              key={p.n}
              className="group relative bg-[color:var(--color-sa-charcoal)] p-8 transition-colors duration-300 hover:bg-[color:var(--color-sa-green-deep)] md:p-10"
              style={{ borderTop: `3px solid ${p.tint}` }}
            >
              <div
                className="font-display text-[3rem] leading-none tabular italic"
                style={{ color: p.tint }}
              >
                {p.n}
              </div>
              <h3 className="mt-6 font-display text-2xl leading-snug">
                {p.title}
              </h3>
              <p className="mt-3 text-[color:var(--color-sa-cream)]/75">
                {p.body}
              </p>

              <div
                aria-hidden="true"
                className="mt-8 inline-flex h-px w-12 transition-all group-hover:w-20"
                style={{ background: p.tint }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTCOMES  the fabricated testimonials were removed in Phase 23.2 (truth
// rule). Phase 24 re-inhabits this slot with real, admin-curated testimonials.

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYER / GOVERNMENT split
// ─────────────────────────────────────────────────────────────────────────────

function DualSplit({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"landing">>>;
}) {
  return (
    <section className="bg-[color:var(--color-sa-cream)]">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 md:grid-cols-2">
        {/* Employer  cream + green */}
        <article className="relative overflow-hidden bg-[color:var(--color-sa-green-tint)] p-10 md:p-16">
          <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
            {t("split.employer.eyebrow")}
          </div>
          <h3 className="mt-3 max-w-md font-display text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.05] tracking-[-0.02em] text-[color:var(--color-sa-charcoal)]">
            {t("split.employer.heading")}
          </h3>
          <p className="mt-4 max-w-md text-[color:var(--color-sa-charcoal)]/80">
            {t("split.employer.body")}
          </p>
          <Link
            href="/employer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-sa-green-deep)] px-6 py-3 text-sm font-medium text-[color:var(--color-sa-cream)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            {t("split.employer.cta")}
            <span aria-hidden="true">↗</span>
          </Link>

          <SAChevron
            variant="signature"
            className="pointer-events-none absolute -bottom-12 -right-12 size-72 opacity-[0.12]"
          />
        </article>

        {/* Government  charcoal + gold */}
        <article className="relative overflow-hidden bg-[color:var(--color-sa-charcoal)] p-10 text-[color:var(--color-sa-cream)] md:p-16">
          <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-gold)]">
            {t("split.government.eyebrow")}
          </div>
          <h3 className="mt-3 max-w-md font-display text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.05] tracking-[-0.02em]">
            {t("split.government.heading")}
          </h3>
          <p className="mt-4 max-w-md text-[color:var(--color-sa-cream)]/80">
            {t("split.government.body")}
          </p>
          <Link
            href="/insights"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-sa-gold)] px-6 py-3 text-sm font-medium text-[color:var(--color-sa-charcoal)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            {t("split.government.cta")}
            <span aria-hidden="true">↗</span>
          </Link>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -right-10 size-72 rounded-full bg-[color:var(--color-sa-green)] opacity-20 blur-3xl"
          />
        </article>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ  Phase 33. Six real questions, answered honestly (D4: platform
// facts only, no superlatives). The SAME strings feed the FAQPage
// JSON-LD mounted at the top of the page  Google requires the marked-
// up content to be visible on the page, so the two must not drift.
// Native <details>/<summary> accordion: zero JS, keyboard-accessible,
// No-Flash compliant.
// ─────────────────────────────────────────────────────────────────────────────

function FAQ({ t, items }: { t: LandingT; items: { question: string; answer: string }[] }) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-h"
      className="bg-[color:var(--color-sa-cream)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <header className="mb-10 md:mb-14">
          <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
            <SAChevron variant="mark" className="size-3" />
            {t("faq.eyebrow")}
          </div>
          <h2
            id="faq-h"
            className="mt-3 max-w-3xl font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
          >
            {t("faq.h2a")}{" "}
            <span className="italic text-[color:var(--color-sa-green-deep)]">
              {t("faq.h2bItalic")}
            </span>
            .
          </h2>
        </header>

        <div className="divide-y divide-[color:var(--color-sa-charcoal)]/10 border-y border-[color:var(--color-sa-charcoal)]/10">
          {items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 text-left md:py-6 [&::-webkit-details-marker]:hidden">
                <span className="font-display text-xl leading-snug text-[color:var(--color-sa-charcoal)] md:text-2xl">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 font-display text-2xl leading-none text-[color:var(--color-sa-gold-deep)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-6 leading-relaxed text-[color:var(--color-ink-soft)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCTA({ t }: { t: LandingT }) {
  return (
    <section
      aria-labelledby="cta-h"
      className="relative overflow-hidden bg-[color:var(--color-sa-cream)] py-24 md:py-32"
    >
      <SAChevron
        variant="signature"
        className="pointer-events-none absolute -left-32 top-1/2 size-[640px] -translate-y-1/2 opacity-[0.06]"
      />

      <div className="relative mx-auto max-w-[1320px] px-5 text-center md:px-10">
        <div className="text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
          {t("finalCta.eyebrow")}
        </div>
        <h2
          id="cta-h"
          className="mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.025em]"
        >
          {t("finalCta.h2a")}
          <br />
          <span className="italic text-[color:var(--color-sa-green-deep)]">
            {t("finalCta.h2bItalic")}
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[color:var(--color-ink-soft)]">
          {t("finalCta.lead")}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up/seeker"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-sa-charcoal)] px-7 py-3.5 text-sm font-medium text-[color:var(--color-sa-cream)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            {t("finalCta.ctaCreate")}
            <span aria-hidden="true">↗</span>
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--color-sa-charcoal)] px-7 py-3.5 text-sm font-medium text-[color:var(--color-sa-charcoal)] transition-colors hover:bg-[color:var(--color-sa-charcoal)] hover:text-[color:var(--color-sa-cream)]"
          >
            {t("finalCta.ctaFind")}
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          <span>{t("finalCta.trust1")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("finalCta.trust2")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("finalCta.trust3")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("finalCta.trust4")}</span>
        </div>
      </div>
    </section>
  );
}
