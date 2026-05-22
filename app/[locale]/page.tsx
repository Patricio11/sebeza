import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchBar } from "@/components/feature/SearchBar";
import { SAChevron } from "@/components/ui/SAChevron";
import { AnimatedCount } from "@/components/feature/AnimatedCount";
import { dataProvider } from "@/lib/data/provider";
import { overallFreshnessConfidence } from "@/lib/mock/analytics";
import { ArrowUpRight, MapPin, Clock, Sparkles, Quote } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Landing page — Mzansi National.
//
// A national platform asks for a national-feeling landing. Inspired by the SA
// flag without ever literally rendering it: deep flag-green primary, SA-gold
// accent, an abstracted Y-chevron as the structural mark, charcoal + cream
// for surface and text.
//
// Composition is deliberately editorial-asymmetric — never centered SaaS hero,
// never card-grid feature blocks. Motion is reserved: a one-time stagger on
// the hero text, count-up numerals on the pulse strip, and the chevron's
// hairline drawing in. All else is still.
//
// This is the landing only — `SiteHeader`/styling on every other page stays
// untouched until you approve, so you can review side-by-side.
// ─────────────────────────────────────────────────────────────────────────────

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const analytics = await dataProvider.getAnalyticsSnapshot();
  const confidence = overallFreshnessConfidence(analytics);

  return (
    <div className="bg-[color:var(--color-sa-cream)] text-[color:var(--color-sa-charcoal)]">
      <LandingHeader />
      <main id="main">
        <Hero t={t} analytics={analytics} confidence={confidence} locale={locale} />
        <PulseStrip t={t} analytics={analytics} confidence={confidence} locale={locale} />
        <Difference />
        <Pillars t={t} />
        <Outcomes />
        <DualSplit t={t} />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

async function Hero({
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
  const nfmt = new Intl.NumberFormat(locale);

  return (
    <section
      aria-label="Hero"
      className="relative overflow-hidden bg-[color:var(--color-sa-cream)] pt-28 pb-20 md:min-h-[88vh] md:pt-36 md:pb-28"
    >
      {/* Oversized chevron motif anchored to the right. Bleeds off-screen on the
          right edge — gives the page identity at first glance. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-0 hidden h-full w-[58%] opacity-[0.85] md:block lg:right-[-6%]"
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

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-12 gap-8 px-5 md:px-10">
        {/* Content column */}
        <div className="col-span-12 md:col-span-7">
          {/* Eyebrow */}
          <div className="anim-rise anim-delay-1 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
            <SAChevron variant="mark" className="size-3" />
            A national talent register · 2026
            <span
              aria-hidden="true"
              className="ml-1 inline-block h-px w-10 bg-[color:var(--color-sa-charcoal)]"
            />
          </div>

          {/* Headline — broken on purpose, last line italic in gold */}
          <h1 className="mt-7 font-display text-[color:var(--color-sa-charcoal)]">
            <span className="anim-rise-soft anim-delay-2 block leading-[0.95] tracking-[-0.025em] text-[clamp(3rem,9vw,7.2rem)]">
              South Africa&apos;s
            </span>
            <span className="anim-rise-soft anim-delay-3 block leading-[0.95] tracking-[-0.025em] text-[clamp(3rem,9vw,7.2rem)]">
              talent.
            </span>
            <span className="anim-rise-soft anim-delay-4 block leading-[0.95] tracking-[-0.025em] text-[clamp(3rem,9vw,7.2rem)]">
              <span className="italic font-light text-[color:var(--color-sa-gold-deep)]">
                Visible.
              </span>{" "}
              <span className="text-[color:var(--color-sa-green-deep)]">
                In real time.
              </span>
            </span>
          </h1>

          <p className="anim-rise-soft anim-delay-5 mt-7 max-w-xl text-lg leading-relaxed text-[color:var(--color-ink-soft)] md:text-xl">
            {t("hero.subhead")}
          </p>

          {/* Search */}
          <div className="anim-rise-soft anim-delay-6 mt-9 max-w-2xl">
            <SearchBar variant="hero" />
          </div>

          {/* Popular chips */}
          <div className="anim-fade anim-delay-7 mt-5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
            <span className="uppercase tracking-[0.22em] text-[color:var(--color-sa-green-deep)]">
              {t("search.recentChips")}
            </span>
            {[
              ["Chefs", "Cape Town", "chef", "western-cape"],
              ["Developers", "Johannesburg", "developer", "gauteng"],
              ["Electricians", "Pretoria", "electrician", "gauteng"],
              ["Nurses", "Durban", "nurse", "kwazulu-natal"],
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

        {/* Right column — floating "live national pulse" mini-dossier */}
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
                Live · National pulse
              </div>

              <h2 className="mt-2 font-display text-2xl leading-tight">
                Today on Sebenza
              </h2>

              <dl className="mt-6 space-y-4">
                <DossierStat
                  label="Active profiles"
                  value={
                    <AnimatedCount
                      value={analytics.totalActive}
                      locale={locale}
                      className="font-display tabular text-3xl"
                    />
                  }
                  trend="+8.2% MoM"
                />
                <DossierStat
                  label="Confirmed hires · May"
                  value={
                    <AnimatedCount
                      value={analytics.confirmedHiresThisMonth}
                      locale={locale}
                      className="font-display tabular text-3xl"
                    />
                  }
                  trend="+11% MoM"
                />
                <DossierStat
                  label="Tracked skills"
                  value={
                    <span className="font-display tabular text-3xl">
                      {analytics.demandBySkill.length}
                    </span>
                  }
                />
              </dl>

              <div className="mt-6 rounded-xl bg-[color:var(--color-sa-green-tint)] p-4">
                <div className="flex items-baseline justify-between text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-sa-green-deep)]">
                  <span>Freshness confidence</span>
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
                  Weighted share of statuses confirmed in the last 30 days.
                  Stale data is honestly down-ranked — never spun.
                </p>
              </div>

              <Link
                href="/insights"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-sa-green-deep)] hover:underline"
              >
                See the national insights
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
        Scroll · the bulletin
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
// PULSE STRIP — the high-contrast moment
// ─────────────────────────────────────────────────────────────────────────────

function PulseStrip({
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
  return (
    <section
      aria-labelledby="pulse-h"
      className="grain-overlay relative overflow-hidden bg-[color:var(--color-sa-green-deep)] text-[color:var(--color-sa-cream)]"
    >
      {/* Gold underline at top, deep stripe — a band echoing the flag */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[color:var(--color-sa-gold)]" />

      <div className="relative mx-auto max-w-[1320px] px-5 py-20 md:px-10 md:py-28">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-gold)]">
              <SAChevron variant="mark" className="size-3" />
              Bulletin · {new Date().toISOString().slice(0, 10)}
            </div>
            <h2
              id="pulse-h"
              className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.98] tracking-[-0.02em]"
            >
              The number ESSA{" "}
              <span className="italic text-[color:var(--color-sa-gold)]">cannot</span>{" "}
              put on the table.
            </h2>
          </div>
          <p className="max-w-sm text-[color:var(--color-sa-cream)]/80">
            Three live, freshness-weighted readings of the South African
            workforce. Updated continuously, never spun.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-[color:var(--color-sa-green)]/40 md:grid-cols-3">
          <BigStat
            label="Active profiles"
            value={
              <AnimatedCount
                value={analytics.totalActive}
                locale={locale}
                className="font-display tabular text-[clamp(3.2rem,6vw,5.2rem)] leading-none"
              />
            }
            spark={analytics.trend.map((m) => m.registrations)}
            footnote={`${Math.round(confidence * 100)}% confidence · 30-day`}
            iconRight={<MapPin className="size-4" aria-hidden="true" />}
          />
          <BigStat
            label="Confirmed hires · May"
            value={
              <AnimatedCount
                value={analytics.confirmedHiresThisMonth}
                locale={locale}
                className="font-display tabular text-[clamp(3.2rem,6vw,5.2rem)] leading-none"
              />
            }
            spark={analytics.trend.map((m) => m.placements)}
            footnote="Logged via the platform · not self-reported"
            iconRight={<Clock className="size-4" aria-hidden="true" />}
            accent
          />
          <BigStat
            label="Skills tracked"
            value={
              <span className="font-display tabular text-[clamp(3.2rem,6vw,5.2rem)] leading-none">
                {analytics.demandBySkill.length}
              </span>
            }
            footnote="Across 9 provinces"
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
// DIFFERENCE — comparison, framed positively (the wedge, honestly)
// ─────────────────────────────────────────────────────────────────────────────

const DIFF_ROWS: { dimension: string; old: string; sebenza: string }[] = [
  {
    dimension: "Employment data",
    old: "Snapshot at registration; rarely refreshed.",
    sebenza: "Live, status-time-stamped, freshness-weighted.",
  },
  {
    dimension: "Skills gap visibility",
    old: "Anecdotal; lags by months.",
    sebenza: "Derived from real-time employer searches.",
  },
  {
    dimension: "Verification",
    old: "Self-reported, indistinguishable from real.",
    sebenza: "Honest states — `unverified` is the default.",
  },
  {
    dimension: "Built for",
    old: "Desktop, broadband, English.",
    sebenza: "360px Android, 3G, four launch languages.",
  },
];

function Difference() {
  return (
    <section
      aria-labelledby="diff-h"
      className="bg-[color:var(--color-sa-cream)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <header className="mb-12 md:mb-16">
          <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
            <SAChevron variant="mark" className="size-3" />
            Where we differ
          </div>
          <h2
            id="diff-h"
            className="mt-3 max-w-3xl font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
          >
            The register exists.
            <br />
            <span className="italic text-[color:var(--color-sa-green-deep)]">
              The signal
            </span>{" "}
            does not.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--color-ink-soft)]">
            We are not rebuilding ESSA. ESSA is mandated and free. Where it
            falls short — data quality, usability, real-time analytics — is
            exactly where we win.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr] md:gap-12 md:items-stretch">
          {/* Old column */}
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.28em] text-[color:var(--color-ink-soft)]">
              The 90-day-old register
            </div>
            <ul className="mt-4 divide-y divide-[color:var(--color-sa-charcoal)]/10 border-t border-[color:var(--color-sa-charcoal)]/15">
              {DIFF_ROWS.map((row) => (
                <li key={row.dimension} className="py-5">
                  <div className="text-[0.66rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                    {row.dimension}
                  </div>
                  <div className="mt-1.5 text-base italic text-[color:var(--color-ink-soft)]">
                    {row.old}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Spine */}
          <div
            aria-hidden="true"
            className="relative hidden md:flex md:w-12 md:items-center md:justify-center"
          >
            <div className="h-full w-px bg-[color:var(--color-sa-charcoal)]/15" />
            <div className="absolute inline-flex size-10 items-center justify-center rounded-full bg-[color:var(--color-sa-charcoal)] text-[color:var(--color-sa-gold)]">
              <SAChevron variant="inline" className="size-5" />
            </div>
          </div>

          {/* Sebenza column */}
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
              Sebenza
            </div>
            <ul className="mt-4 divide-y divide-[color:var(--color-sa-green)]/30 border-t-2 border-[color:var(--color-sa-green-deep)]">
              {DIFF_ROWS.map((row) => (
                <li key={row.dimension} className="py-5">
                  <div className="text-[0.66rem] uppercase tracking-[0.22em] text-[color:var(--color-sa-green-deep)]">
                    {row.dimension}
                  </div>
                  <div className="mt-1.5 font-display text-lg leading-snug text-[color:var(--color-sa-charcoal)]">
                    {row.sebenza}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pull quote */}
        <blockquote className="mt-16 max-w-3xl border-l-4 border-[color:var(--color-sa-gold)] pl-6 md:mt-20">
          <Quote
            className="mb-3 size-5 text-[color:var(--color-sa-green-deep)]"
            aria-hidden="true"
          />
          <p className="font-display text-2xl italic leading-snug text-[color:var(--color-sa-charcoal)] md:text-3xl">
            The trustworthy, real-time layer ESSA never had.
          </p>
          <cite className="mt-3 block text-[0.72rem] uppercase not-italic tracking-[0.24em] text-[color:var(--color-ink-soft)]">
            — Sebenza · strategy brief, 2026
          </cite>
        </blockquote>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PILLARS — three things we do that the old system can't
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
            The wedge
          </div>
          <h2
            id="pillars-h"
            className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
          >
            Three things we do — and they cannot.
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
// OUTCOMES — humanise the platform
// ─────────────────────────────────────────────────────────────────────────────

interface Outcome {
  initials: string;
  initialsBg: string;
  initialsFg: string;
  name: string;
  role: string;
  city: string;
  quote: string;
  outcome: string;
  daysToHire: number;
}

const OUTCOMES: Outcome[] = [
  {
    initials: "T",
    initialsBg: "var(--color-sa-green)",
    initialsFg: "var(--color-sa-cream)",
    name: "Thandeka M.",
    role: "Senior Pastry Chef",
    city: "Cape Town",
    quote:
      "I confirmed I was open to work on a Sunday. By Friday I'd done two trial services. Tasting menu starts in three weeks.",
    outcome: "Hired at La Colombe",
    daysToHire: 11,
  },
  {
    initials: "K",
    initialsBg: "var(--color-sa-gold)",
    initialsFg: "var(--color-sa-charcoal)",
    name: "Kabelo M.",
    role: "Electrician",
    city: "Pretoria",
    quote:
      "My INDLELA trade test was already verified on the profile. The site supervisor saw it before they called.",
    outcome: "Site role with Group Five",
    daysToHire: 6,
  },
  {
    initials: "L",
    initialsBg: "var(--color-sa-charcoal)",
    initialsFg: "var(--color-sa-gold)",
    name: "Lerato N.",
    role: "Senior Software Engineer",
    city: "Johannesburg",
    quote:
      "The Career compass told me Kubernetes was the missing skill in Gauteng. I logged the cert; my rank moved from 4 to 2 the same week.",
    outcome: "Offer from Discovery Bank",
    daysToHire: 19,
  },
];

function Outcomes() {
  return (
    <section
      aria-labelledby="out-h"
      className="bg-[color:var(--color-sa-cream)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <header className="mb-12 grid items-end gap-6 md:mb-16 md:grid-cols-[2fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
              <SAChevron variant="mark" className="size-3" />
              Real outcomes
            </div>
            <h2
              id="out-h"
              className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
            >
              Confirmed hires.
              <br />
              <span className="italic text-[color:var(--color-sa-green-deep)]">
                Not screenshots.
              </span>
            </h2>
          </div>
          <p className="text-[color:var(--color-ink-soft)]">
            Three anonymised placements logged on Sebenza this month. We
            count hires only when both the employer and the candidate
            confirm them — that is how the freshness numbers stay honest.
          </p>
        </header>

        <ul className="grid gap-6 md:grid-cols-3">
          {OUTCOMES.map((o, i) => (
            <li
              key={i}
              className="group relative flex flex-col gap-5 rounded-2xl border border-[color:var(--color-sa-charcoal)]/10 bg-white p-7 transition-transform hover:-translate-y-1 hover:shadow-press md:p-8"
            >
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-full font-display text-2xl"
                  style={{
                    background: o.initialsBg,
                    color: o.initialsFg,
                  }}
                >
                  {o.initials}
                </span>
                <div>
                  <div className="font-display text-lg leading-tight">
                    {o.name}
                  </div>
                  <div className="text-sm text-[color:var(--color-ink-soft)]">
                    {o.role} · {o.city}
                  </div>
                </div>
              </div>

              <blockquote className="border-l-2 border-[color:var(--color-sa-gold)] pl-4 text-[color:var(--color-sa-charcoal)]">
                <p className="font-display text-lg italic leading-snug">
                  &ldquo;{o.quote}&rdquo;
                </p>
              </blockquote>

              <div className="mt-auto flex items-baseline justify-between border-t border-dashed border-[color:var(--color-sa-charcoal)]/15 pt-4">
                <div>
                  <div className="text-[0.66rem] uppercase tracking-[0.22em] text-[color:var(--color-sa-green-deep)]">
                    Outcome
                  </div>
                  <div className="text-sm font-medium">{o.outcome}</div>
                </div>
                <div className="text-right">
                  <div className="text-[0.66rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                    Days
                  </div>
                  <div className="font-display tabular text-3xl text-[color:var(--color-sa-green-deep)]">
                    {o.daysToHire}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

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
        {/* Employer — cream + green */}
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

        {/* Government — charcoal + gold */}
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
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCTA() {
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
          Built for South Africa · by South Africa
        </div>
        <h2
          id="cta-h"
          className="mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.025em]"
        >
          Get found.
          <br />
          <span className="italic text-[color:var(--color-sa-green-deep)]">
            Or find someone.
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[color:var(--color-ink-soft)]">
          Whether you&apos;re looking for work or looking for people — the
          fastest way to a real, verified, current match is one search away.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up/seeker"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-sa-charcoal)] px-7 py-3.5 text-sm font-medium text-[color:var(--color-sa-cream)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            Create a profile
            <span aria-hidden="true">↗</span>
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--color-sa-charcoal)] px-7 py-3.5 text-sm font-medium text-[color:var(--color-sa-charcoal)] transition-colors hover:bg-[color:var(--color-sa-charcoal)] hover:text-[color:var(--color-sa-cream)]"
          >
            Find talent
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          <span>POPIA-first</span>
          <span aria-hidden="true">·</span>
          <span>WCAG 2.2 AA</span>
          <span aria-hidden="true">·</span>
          <span>Works on 3G</span>
          <span aria-hidden="true">·</span>
          <span>4 launch languages</span>
        </div>
      </div>
    </section>
  );
}
