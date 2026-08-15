import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
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

export const metadata: Metadata = {
  title: "How Sebenza Works",
  description:
    "Sebenza is South Africa's POPIA-first national talent register. Job seekers build one free profile and get found; employers search live, honestly-verified talent; confirmed hiring becomes real labour-market intelligence.",
  alternates: localeAlternates("/marketing"),
};

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
            <Eyebrow>South Africa&rsquo;s national talent platform</Eyebrow>
            <h1 className="mt-4 font-display text-4xl leading-[1.02] tracking-[-0.02em] md:text-6xl">
              Find the person.
              <br />
              <span className="italic text-[color:var(--color-brand-strong)]">
                Trust the profile.
              </span>{" "}
              Count the hire.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-ink-soft)]">
              Sebenza is a POPIA-first national talent register. Job seekers
              build one free profile and get found. Employers search live,
              freshness-weighted, honestly-verified talent. And the hiring
              that follows becomes real labour-market intelligence, not
              guesswork.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillLink href="/search" primary>
                Search the talent register
              </PillLink>
              <PillLink href="/sign-up/seeker">Create a free profile</PillLink>
              <a
                href="mailto:info@sebenzasa.com"
                className="text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
              >
                Talk to us
              </a>
            </div>
            <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
              Free for job seekers, always. Works on any phone, in English,
              isiZulu, isiXhosa and Afrikaans.
            </p>
          </div>
        </section>

        {/* ── 2 · The problem ──────────────────────────────────────────── */}
        <section className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
          <Eyebrow>The reality</Eyebrow>
          <SectionHeading>Hiring in South Africa runs on noise</SectionHeading>
          <ul className="mt-6 max-w-2xl space-y-3">
            {[
              "A hundred CVs in a WhatsApp group, and no way to tell who is real.",
              "Databases where half the “available” people found work months ago.",
              "Badges that say verified when nobody actually verified anything.",
              "Job seekers paying to be seen, or losing money to fake recruiters.",
              "Policy written from surveys that were old before they were published.",
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
            South Africa does not have a talent shortage. It has a
            trustworthy-signal shortage.{" "}
            <span className="italic text-[color:var(--color-brand-strong)]">
              That is the problem Sebenza fixes.
            </span>
          </p>
        </section>

        {/* ── 3 · Who it's for ─────────────────────────────────────────── */}
        <section className="border-y border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[1100px] px-5 py-14 md:py-20">
            <Eyebrow>Who it&rsquo;s for</Eyebrow>
            <SectionHeading>One register, three sides</SectionHeading>
            <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-hairline)] md:grid-cols-3">
              {[
                {
                  title: "Job seekers",
                  tag: "free, always",
                  body: "Build one profile: your skills, experience, availability, and where you are. Get found by verified employers, get invited to real named roles, apply through public vacancy links, and control every bit of your information under POPIA. From general workers and artisans to graduates and professionals. Students too.",
                },
                {
                  title: "Employers",
                  tag: "from spaza to enterprise",
                  body: "Search by skill, place and availability, not by luck. See honest verification states and how fresh each profile is. Run vacancies: reverse-match candidates, invite them to named roles, share a public apply link on WhatsApp, and log the hire when it happens.",
                },
                {
                  title: "Government & institutions",
                  tag: "aggregate only",
                  body: "A privacy-floored, read-only analytics portal: where demand is, where supply is, why roles go unfilled, why learners stall, and how curriculum lines up with the market. Every figure is k-anonymised and aggregate. Never an identifiable person.",
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
          <Eyebrow>The difference</Eyebrow>
          <SectionHeading>Honesty is the feature</SectionHeading>
          <dl className="mt-8 space-y-6">
            {[
              {
                icon: <BadgeCheck className="size-5" aria-hidden="true" />,
                term: "“Unverified” is the default.",
                body: "A badge only says verified when something was actually verified. We never dress up self-reported data.",
              },
              {
                icon: <Clock className="size-5" aria-hidden="true" />,
                term: "Freshness is ranked.",
                body: "Every employment status carries a confirmation date. Stale profiles fall honestly down the list instead of wasting your calls.",
              },
              {
                icon: <ShieldCheck className="size-5" aria-hidden="true" />,
                term: "A hire only counts when it's confirmed.",
                body: "Our placement numbers are logged through the platform, never self-reported into a spreadsheet.",
              },
              {
                icon: <Lock className="size-5" aria-hidden="true" />,
                term: "Public profiles are redacted.",
                body: "No ID numbers, no documents, no contact details in search. Contact is revealed only to verified employers, with consent, and every reveal is logged where the seeker can see it.",
              },
              {
                icon: <MapPin className="size-5" aria-hidden="true" />,
                term: "Location, never nationality.",
                body: "People are matched by where they are and what they can do. Nationality is shown, never a gate.",
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
            <Eyebrow>How it works</Eyebrow>
            <SectionHeading>One loop, from profile to policy</SectionHeading>
            <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
              The hiring is the product. The analytics fall out of it
              honestly.
            </p>
            <ol className="mt-8 space-y-5">
              {[
                {
                  title: "A seeker builds one profile.",
                  body: "Skills, experience, availability, place. Free, in four languages, on any phone.",
                },
                {
                  title: "Employers search or match.",
                  body: "Live filters by skill, province and availability, or reverse-matching against a specific vacancy.",
                },
                {
                  title: "Roles reach people two ways.",
                  body: "The employer invites a seeker to a named role, or shares the vacancy's public Self Apply link anywhere, including WhatsApp, and seekers walk in themselves.",
                },
                {
                  title: "Contact is revealed with consent.",
                  body: "Verified employers only. Audited every time. The seeker sees who reached them.",
                },
                {
                  title: "The hire is confirmed.",
                  body: "Logged through the platform, so it counts once and counts true.",
                },
                {
                  title: "The nation learns.",
                  body: "Confirmed hiring rolls up into k-anonymised analytics: demand, supply, shortages, outcomes. Live, not last year.",
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

        {/* ── 6 · Proof: live numbers, no invented quotes ─────────────── */}
        <section className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
          <Eyebrow>Proof</Eyebrow>
          <SectionHeading>We&rsquo;d rather show you the live numbers</SectionHeading>
          <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
            These figures render straight from the register the moment you
            load this page. They are the same numbers our own dashboards run
            on. Freshness-weighted, never inflated.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-ink)] sm:grid-cols-3">
            <LiveStat
              label="Active profiles"
              value={nfmt.format(analytics.totalActive)}
              icon={<Users className="size-4" aria-hidden="true" />}
            />
            <LiveStat
              label={`Confirmed hires · ${currentMonth}`}
              value={nfmt.format(analytics.confirmedHiresThisMonth)}
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
              accent
            />
            <LiveStat
              label="Skills tracked"
              value={nfmt.format(analytics.demandBySkill.length)}
              icon={<BadgeCheck className="size-4" aria-hidden="true" />}
            />
          </div>

          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
            Sebenza is young and we won&rsquo;t pretend otherwise. We
            don&rsquo;t invent five-star quotes: as real people and employers
            say real things, their words appear here with their names
            attached, and only with their consent.
          </p>

          {/* Real, admin-curated, consented testimonials. Renders nothing
              until approved quotes exist (the honest empty state IS the
              copy above). */}
          <TestimonialsRail />

          <div className="mt-10 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              What we can promise today
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[color:var(--color-ink)]">
              <li>
                Free for job seekers. No fees, ever, and no paying to rank
                higher.
              </li>
              <li>
                POPIA-first from the first line of code: granular consent,
                field-level encryption, a permanent audit log, export and
                erasure built in.
              </li>
              <li>
                Honest badges, honest freshness, honest placement counts. The
                register would rather look smaller than lie.
              </li>
              <li>
                Built for the real South Africa: a low-end Android on 3G is
                our reference device, four launch languages, installable like
                an app.
              </li>
            </ul>
          </div>
        </section>

        {/* ── 7 · Why Sebenza ──────────────────────────────────────────── */}
        <section className="border-y border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
            <Eyebrow>Why Sebenza</Eyebrow>
            <SectionHeading>
              Why Sebenza, and not another job board
            </SectionHeading>
            <dl className="mt-8 space-y-6">
              {[
                {
                  term: "It's a register, not a pinboard.",
                  body: "Job boards list adverts. Sebenza maintains a living, freshness-weighted register of people, and roles come to them.",
                },
                {
                  term: "Trust is engineered, not claimed.",
                  body: "Verification states, consent gates, audited reveals and redaction are enforced in code, on every read.",
                },
                {
                  term: "The analytics nobody else has.",
                  body: "Because hires are confirmed in-platform, the aggregate picture is real: live shortage signals, placement outcomes, curriculum-versus-demand. All k-anonymised.",
                },
                {
                  term: "Hiring flows both directions.",
                  body: "Employers pull with search and invitations; seekers walk in through public Self Apply links shared anywhere. One pipeline, honestly labelled.",
                },
                {
                  term: "Your data stays yours.",
                  body: "Seekers can pause visibility, block an employer, export everything, or erase themselves. Consent is per-purpose, never a blanket tick-box.",
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
          <Eyebrow>Pricing</Eyebrow>
          <SectionHeading>
            Free for job seekers. Simple for everyone else.
          </SectionHeading>
          <p className="mt-3 max-w-2xl leading-relaxed text-[color:var(--color-ink-soft)]">
            A national register only works if every South African can afford
            to be on it, so the seeker side is free, permanently. Employer and
            government partnerships are priced to the size of the team and the
            reporting they need.
          </p>
          <a
            href="mailto:info@sebenzasa.com"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-surface)]"
          >
            Talk to us about a partnership
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </section>

        {/* ── 9 · Final CTA ────────────────────────────────────────────── */}
        <section className="border-t-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-14 text-center md:py-20">
            <div className="flex items-center justify-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              Built for South Africa · by South Africa
            </div>
            <h2 className="mt-4 font-display text-3xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              See the register for yourself.
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[color:var(--color-ink-soft)]">
              Search it as a visitor, join it as a seeker, or write to us and
              we&rsquo;ll walk you through the employer and analytics sides
              with your own use case in mind. No pressure, no jargon.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PillLink href="/search" primary>
                Search talent
              </PillLink>
              <PillLink href="/sign-up/seeker">Create a free profile</PillLink>
              <a
                href="mailto:info@sebenzasa.com"
                className="text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
              >
                Talk to us
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
