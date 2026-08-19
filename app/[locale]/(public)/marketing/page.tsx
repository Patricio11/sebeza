import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SAChevron } from "@/components/ui/SAChevron";
import { TestimonialsRail } from "@/components/feature/TestimonialsRail";
import { Link } from "@/i18n/navigation";
import { dataProvider } from "@/lib/data/provider";
import { localeAlternates } from "@/lib/seo";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  Lock,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";

/**
 * The `/marketing` explainer funnel (docs/MARKETING_PAGE_COPY.md is the
 * copy of record; edit there first, then mirror here).
 *
 * This is the page the founder sends instead of explaining Sebenza over
 * and over: employer, partner, department, journalist. `/` stays the
 * visual, product-led landing; this is the copy-led story told in the
 * platform's own honesty rules:
 *   - live numbers from the register, never hard-typed
 *   - the consented testimonial rail, empty until real quotes exist
 *   - never names the incumbent registry or any competitor
 *   - every claim maps to something shipped
 *
 * Server-rendered, zero client JS of its own (No-Flash). Inherits the
 * Phase 33 OG defaults, so sharing this link on WhatsApp unfurls the
 * branded card.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/marketing"),
  };
}

// Re-prerender every 5 minutes: the proof section renders live register
// numbers and shouldn't be frozen at build time. Same ISR posture as
// /insights.
export const revalidate = 300;

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing");

  // Live numbers only (copy rule): the same snapshot the landing pulse
  // and dashboards run on. Nothing on this page is hard-typed.
  const analytics = await dataProvider.getAnalyticsSnapshot();
  const nfmt = new Intl.NumberFormat(locale);
  const currentMonth = new Intl.DateTimeFormat(locale, {
    month: "long",
  }).format(new Date());

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-[color:var(--color-paper)]">
        {/* ── 1 · Hero ─────────────────────────────────────────────────── */}
        <section className="border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
            <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
            <h1 className="mt-4 font-display text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
              {t("hero.h1a")}
              <br />
              <span className="italic text-[color:var(--color-brand-strong)]">
                {t("hero.h1bItalic")}
              </span>{" "}
              {t("hero.h1c")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-ink-soft)]">
              {t("hero.lead")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillLink href="/search" primary>
                {t("hero.ctaSearch")}
              </PillLink>
              <PillLink href="/sign-up/seeker">{t("hero.ctaCreate")}</PillLink>
              <a
                href="mailto:info@sebenzasa.com"
                className="text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
              >
                {t("hero.ctaTalk")}
              </a>
            </div>
            <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
              {t("hero.microcopy")}
            </p>
          </div>
        </section>

        {/* ── 2 · The problem ──────────────────────────────────────────── */}
        <section className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
          <Eyebrow>{t("problem.eyebrow")}</Eyebrow>
          <SectionHeading>{t("problem.heading")}</SectionHeading>
          <ul className="mt-6 max-w-2xl space-y-3">
            {[
              t("problem.item1"),
              t("problem.item2"),
              t("problem.item3"),
              t("problem.item4"),
              t("problem.item5"),
            ].map((line) => (
              <li
                key={line}
                className="border-l-2 border-[color:var(--color-accent)] pl-4 leading-relaxed text-[color:var(--color-ink)]"
              >
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl font-display text-xl leading-snug text-[color:var(--color-ink)]">
            {t("problem.closeA")}{" "}
            <span className="italic text-[color:var(--color-brand-strong)]">
              {t("problem.closeItalic")}
            </span>
          </p>
        </section>

        {/* ── 3 · Who it's for ─────────────────────────────────────────── */}
        <section className="border-y border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[1100px] px-5 py-14 md:py-20">
            <Eyebrow>{t("who.eyebrow")}</Eyebrow>
            <SectionHeading>{t("who.heading")}</SectionHeading>
            <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-hairline)] md:grid-cols-3">
              {[
                {
                  title: t("who.seekersTitle"),
                  tag: t("who.seekersTag"),
                  body: t("who.seekersBody"),
                },
                {
                  title: t("who.employersTitle"),
                  tag: t("who.employersTag"),
                  body: t("who.employersBody"),
                },
                {
                  title: t("who.governmentTitle"),
                  tag: t("who.governmentTag"),
                  body: t("who.governmentBody"),
                },
              ].map((col) => (
                <article
                  key={col.title}
                  className="bg-[color:var(--color-surface)] p-7 md:p-8"
                >
                  <h3 className="font-display text-2xl leading-tight text-[color:var(--color-ink)]">
                    {col.title}
                  </h3>
                  <p className="mt-1 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
                    {col.tag}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                    {col.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4 · What changes ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
          <Eyebrow>{t("difference.eyebrow")}</Eyebrow>
          <SectionHeading>{t("difference.heading")}</SectionHeading>
          <dl className="mt-8 space-y-6">
            {[
              {
                icon: <BadgeCheck className="size-5" aria-hidden="true" />,
                term: t("difference.t1"),
                body: t("difference.b1"),
              },
              {
                icon: <Clock className="size-5" aria-hidden="true" />,
                term: t("difference.t2"),
                body: t("difference.b2"),
              },
              {
                icon: <ShieldCheck className="size-5" aria-hidden="true" />,
                term: t("difference.t3"),
                body: t("difference.b3"),
              },
              {
                icon: <Lock className="size-5" aria-hidden="true" />,
                term: t("difference.t4"),
                body: t("difference.b4"),
              },
              {
                icon: <MapPin className="size-5" aria-hidden="true" />,
                term: t("difference.t5"),
                body: t("difference.b5"),
              },
            ].map((row) => (
              <div key={row.term} className="flex gap-4">
                <span className="mt-0.5 shrink-0 text-[color:var(--color-brand-strong)]">
                  {row.icon}
                </span>
                <div>
                  <dt className="font-display text-lg text-[color:var(--color-ink)]">
                    {row.term}
                  </dt>
                  <dd className="mt-1 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                    {row.body}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 5 · How it works ─────────────────────────────────────────── */}
        <section className="border-y border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
            <Eyebrow>{t("how.eyebrow")}</Eyebrow>
            <SectionHeading>{t("how.heading")}</SectionHeading>
            <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
              {t("how.lead")}
            </p>
            <ol className="mt-8 space-y-5">
              {[
                {
                  title: t("how.s1t"),
                  body: t("how.s1b"),
                },
                {
                  title: t("how.s2t"),
                  body: t("how.s2b"),
                },
                {
                  title: t("how.s3t"),
                  body: t("how.s3b"),
                },
                {
                  title: t("how.s4t"),
                  body: t("how.s4b"),
                },
                {
                  title: t("how.s5t"),
                  body: t("how.s5b"),
                },
                {
                  title: t("how.s6t"),
                  body: t("how.s6b"),
                },
              ].map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[3rem_1fr] gap-4 border-b border-dashed border-[color:var(--color-hairline)] pb-5 last:border-0"
                >
                  <span className="font-display text-3xl italic leading-none text-[color:var(--color-accent)] tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-lg leading-snug text-[color:var(--color-ink)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 5b · The growth loop (2026-08-19, founder ask)  the seeker-
            side story: Compass → learning path → skill on profile → rank
            rises → found by an employer. ─────────────────────────────── */}
        <section className="bg-[color:var(--color-paper)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
            <Eyebrow>{t("growth.eyebrow")}</Eyebrow>
            <SectionHeading>{t("growth.heading")}</SectionHeading>
            <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
              {t("growth.lead")}
            </p>
            <ol className="mt-8 space-y-5">
              {[
                { title: t("growth.g1t"), body: t("growth.g1b") },
                { title: t("growth.g2t"), body: t("growth.g2b") },
                { title: t("growth.g3t"), body: t("growth.g3b") },
                { title: t("growth.g4t"), body: t("growth.g4b") },
                { title: t("growth.g5t"), body: t("growth.g5b") },
              ].map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[3rem_1fr] gap-4 border-b border-dashed border-[color:var(--color-hairline)] pb-5 last:border-0"
                >
                  <span className="font-display text-3xl italic leading-none text-[color:var(--color-brand)] tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-lg leading-snug text-[color:var(--color-ink)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 6 · Proof: live numbers, no invented quotes ─────────────── */}
        <section className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
          <Eyebrow>{t("proof.eyebrow")}</Eyebrow>
          <SectionHeading>{t("proof.heading")}</SectionHeading>
          <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
            {t("proof.lead")}
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-ink)] sm:grid-cols-3">
            <LiveStat
              label={t("proof.statActive")}
              value={nfmt.format(analytics.totalActive)}
              icon={<Users className="size-4" aria-hidden="true" />}
            />
            <LiveStat
              label={t("proof.statHires", { month: currentMonth })}
              value={nfmt.format(analytics.confirmedHiresThisMonth)}
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
              accent
            />
            <LiveStat
              label={t("proof.statSkills")}
              value={nfmt.format(analytics.demandBySkill.length)}
              icon={<BadgeCheck className="size-4" aria-hidden="true" />}
            />
          </div>

          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
            {t("proof.honest")}
          </p>

          {/* Real, admin-curated, consented testimonials. Renders nothing
              until approved quotes exist (the honest empty state IS the
              copy above). */}
          <TestimonialsRail />

          <div className="mt-10 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              {t("proof.promiseTitle")}
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[color:var(--color-ink)]">
              <li>{t("proof.promise1")}</li>
              <li>{t("proof.promise2")}</li>
              <li>{t("proof.promise3")}</li>
              <li>{t("proof.promise4")}</li>
            </ul>
          </div>
        </section>

        {/* ── 7 · Why Sebenza ──────────────────────────────────────────── */}
        <section className="border-y border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
            <Eyebrow>{t("why.eyebrow")}</Eyebrow>
            <SectionHeading>{t("why.heading")}</SectionHeading>
            <dl className="mt-8 space-y-6">
              {[
                {
                  term: t("why.t1"),
                  body: t("why.b1"),
                },
                {
                  term: t("why.t2"),
                  body: t("why.b2"),
                },
                {
                  term: t("why.t3"),
                  body: t("why.b3"),
                },
                {
                  term: t("why.t4"),
                  body: t("why.b4"),
                },
                {
                  term: t("why.t5"),
                  body: t("why.b5"),
                },
              ].map((row) => (
                <div
                  key={row.term}
                  className="border-l-2 border-[color:var(--color-brand)] pl-4"
                >
                  <dt className="font-display text-lg text-[color:var(--color-ink)]">
                    {row.term}
                  </dt>
                  <dd className="mt-1 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                    {row.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 8 · Pricing ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
          <Eyebrow>{t("pricing.eyebrow")}</Eyebrow>
          <SectionHeading>{t("pricing.heading")}</SectionHeading>
          <p className="mt-3 max-w-2xl leading-relaxed text-[color:var(--color-ink-soft)]">
            {t("pricing.lead")}
          </p>
          <a
            href="mailto:info@sebenzasa.com"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-surface)]"
          >
            {t("pricing.cta")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </section>

        {/* ── 9 · Final CTA ────────────────────────────────────────────── */}
        <section className="border-t-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 text-center md:py-20">
            <div className="flex items-center justify-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              {t("finalCta.eyebrow")}
            </div>
            <h2 className="mt-4 font-display text-3xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              {t("finalCta.heading")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[color:var(--color-ink-soft)]">
              {t("finalCta.lead")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PillLink href="/search" primary>
                {t("finalCta.ctaSearch")}
              </PillLink>
              <PillLink href="/sign-up/seeker">{t("finalCta.ctaCreate")}</PillLink>
              <a
                href="mailto:info@sebenzasa.com"
                className="text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
              >
                {t("finalCta.ctaTalk")}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
      <SAChevron variant="mark" className="size-3" />
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 max-w-3xl font-display text-3xl leading-[1.05] tracking-[-0.02em] md:text-4xl">
      {children}
    </h2>
  );
}

function PillLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href as never}
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-surface)] shadow-press transition-transform hover:-translate-y-0.5"
          : "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-surface)]"
      }
    >
      {children}
      {primary && <ArrowUpRight className="size-4" aria-hidden="true" />}
    </Link>
  );
}

function LiveStat({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-[color:var(--color-ink)] p-6 text-[color:var(--color-paper)] md:p-8">
      <div
        className={
          "flex items-center justify-between text-[0.68rem] uppercase tracking-[0.22em] " +
          (accent ? "text-[color:var(--color-accent)]" : "opacity-70")
        }
      >
        <span>{label}</span>
        <span aria-hidden="true">{icon}</span>
      </div>
      <div
        className={
          "mt-3 font-display text-4xl tabular md:text-5xl " +
          (accent ? "text-[color:var(--color-accent)]" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
