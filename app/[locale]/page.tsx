import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchBar } from "@/components/feature/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { dataProvider } from "@/lib/data/provider";
import { overallFreshnessConfidence } from "@/lib/mock/analytics";

// Landing — the editorial cover. See UX_UI_SPEC §2.1.
// Layout choices that make this *not* a generic SaaS hero:
//   - Asymmetric grid, eyebrow tag, multi-line Fraunces headline broken
//     deliberately (not centered), with one italic accent word.
//   - Search bar IS the hero, composed with hairline dividers + numbered fields.
//   - Pulse strip is a thick-ruled press tile, not feature cards.
//   - Value pillars use big Fraunces ordinals + thick top rule, editorial style.
//   - Two-up institutional split (Employers / Government) reads like a public document.

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
  const nfmt = new Intl.NumberFormat(locale);

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* ───────────────────────────────  HERO  ─────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[1240px] grid-cols-12 gap-6 px-5 pt-12 pb-16 md:px-8 md:pt-20 md:pb-24">
            <div className="col-span-12 md:col-span-7">
              <div className="anim-rise flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-8 bg-[color:var(--color-ink)]"
                />
                A NATIONAL TALENT REGISTER · ZA · MMXXVI
              </div>

              <h1 className="mt-5 font-display text-[color:var(--color-ink)]">
                <span className="anim-rise anim-delay-1 block leading-[1.02] tracking-[-0.02em] text-[clamp(2.6rem,7vw,5.4rem)]">
                  {t("hero.lineOne")}
                </span>
                <span className="anim-rise anim-delay-2 block leading-[1.02] tracking-[-0.02em] text-[clamp(2.6rem,7vw,5.4rem)]">
                  {t("hero.lineTwo")}
                </span>
                <span className="anim-rise anim-delay-3 block leading-[1.02] italic font-light tracking-[-0.02em] text-[clamp(2.6rem,7vw,5.4rem)] text-[color:var(--color-accent)]">
                  {t("hero.lineThree")}
                </span>
              </h1>

              <p className="anim-rise anim-delay-4 mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--color-ink-soft)]">
                {t("hero.subhead")}
              </p>
            </div>

            {/* Sidebar dossier — pulls the eye away from generic hero composition */}
            <aside className="col-span-12 md:col-span-5 md:pl-8">
              <div className="anim-rise anim-delay-3 mt-2 border-t-2 border-[color:var(--color-ink)] pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                    Live freshness
                  </span>
                  <span className="font-display tabular text-2xl">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]">
                  <div
                    className="h-full bg-[color:var(--color-brand)]"
                    style={{ width: `${Math.round(confidence * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-snug text-[color:var(--color-ink-soft)]">
                  Weighted share of employment statuses confirmed in the last 30
                  days. ESSA cannot show this number — and that is the point.
                </p>
              </div>

              <div className="mt-6 border-t border-[color:var(--color-hairline)] pt-4">
                <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                  Today on Sebenza
                </div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <DossierRow
                    label="Active profiles"
                    value={nfmt.format(analytics.totalActive)}
                  />
                  <DossierRow
                    label="Confirmed hires (May)"
                    value={nfmt.format(analytics.confirmedHiresThisMonth)}
                  />
                  <DossierRow
                    label="Tracked skills"
                    value={`${analytics.demandBySkill.length}+`}
                  />
                </ul>
              </div>
            </aside>

            {/* Search composed full-bleed across the grid — the hero IS the search */}
            <div className="anim-rise anim-delay-4 col-span-12 mt-4">
              <SearchBar variant="hero" />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
                <span className="uppercase tracking-[0.2em]">
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
                    href={{
                      pathname: "/search",
                      query: { q: q!, province: p! },
                    }}
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1 hover:border-[color:var(--color-ink)]"
                  >
                    {role} · {city}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────────────  PULSE STRIP  ──────────────────────────── */}
        <section
          aria-labelledby="pulse-h"
          className="border-y-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)]"
        >
          <div className="mx-auto max-w-[1240px] px-5 py-10 md:px-8 md:py-14">
            <header className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                  Bulletin · {new Date().toISOString().slice(0, 10)}
                </div>
                <h2
                  id="pulse-h"
                  className="font-display text-3xl md:text-4xl"
                >
                  {t("pulseStrip.heading")}
                </h2>
              </div>
              <p className="hidden max-w-xs text-sm text-[color:var(--color-ink-soft)] md:block">
                {t("pulseStrip.subheading")}
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label={t("pulseStrip.totalActive")}
                value={nfmt.format(analytics.totalActive)}
                spark={analytics.trend.map((m) => m.registrations)}
                confidence={confidence}
                hint="Live"
              />
              <StatCard
                label={t("pulseStrip.confirmedHires")}
                value={nfmt.format(analytics.confirmedHiresThisMonth)}
                spark={analytics.trend.map((m) => m.placements)}
                hint="May 2026"
              />
              <StatCard
                label={t("pulseStrip.skillsInDemand")}
                value={analytics.demandBySkill.length}
                hint="Tracked"
              />
            </div>
          </div>
        </section>

        {/* ─────────────────────────  VALUE PILLARS  ──────────────────────────── */}
        <section className="mx-auto max-w-[1240px] px-5 py-16 md:px-8 md:py-24">
          <div className="mb-10 flex items-end justify-between border-b-2 border-[color:var(--color-ink)] pb-3">
            <h2 className="font-display text-2xl md:text-3xl">
              Three things we do that the old system can&apos;t.
            </h2>
            <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
              The wedge
            </span>
          </div>
          <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
            <Pillar
              ordinal="I."
              title={t("valueCards.trusted.title")}
              body={t("valueCards.trusted.body")}
            />
            <Pillar
              ordinal="II."
              title={t("valueCards.live.title")}
              body={t("valueCards.live.body")}
            />
            <Pillar
              ordinal="III."
              title={t("valueCards.real.title")}
              body={t("valueCards.real.body")}
            />
          </div>
        </section>

        {/* ──────────────────────  EMPLOYER / GOVERNMENT  ─────────────────────── */}
        <section className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 md:grid-cols-2">
            <SplitPanel
              eyebrow={t("split.employer.eyebrow")}
              heading={t("split.employer.heading")}
              body={t("split.employer.body")}
              cta={{ label: t("split.employer.cta"), href: "/employer" }}
              tone="paper"
            />
            <SplitPanel
              eyebrow={t("split.government.eyebrow")}
              heading={t("split.government.heading")}
              body={t("split.government.body")}
              cta={{ label: t("split.government.cta"), href: "/insights" }}
              tone="ink"
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-1.5">
      <span className="text-[color:var(--color-ink-soft)]">{label}</span>
      <span className="font-display tabular text-[color:var(--color-ink)]">
        {value}
      </span>
    </li>
  );
}

function Pillar({
  ordinal,
  title,
  body,
}: {
  ordinal: string;
  title: string;
  body: string;
}) {
  return (
    <article className="border-t border-[color:var(--color-ink)] pt-5">
      <div className="font-display text-[2.2rem] leading-none italic text-[color:var(--color-accent)]">
        {ordinal}
      </div>
      <h3 className="mt-3 font-display text-xl text-[color:var(--color-ink)]">
        {title}
      </h3>
      <p className="mt-2 text-[color:var(--color-ink-soft)]">{body}</p>
    </article>
  );
}

function SplitPanel({
  eyebrow,
  heading,
  body,
  cta,
  tone,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  cta: { label: string; href: "/employer" | "/insights" };
  tone: "paper" | "ink";
}) {
  const dark = tone === "ink";
  return (
    <div
      className={
        dark
          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)] p-8 md:p-14"
          : "p-8 md:p-14 md:border-r md:border-[color:var(--color-hairline)]"
      }
    >
      <div
        className={
          "text-[0.7rem] uppercase tracking-[0.24em] " +
          (dark ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-ink-soft)]")
        }
      >
        {eyebrow}
      </div>
      <h3 className="mt-3 max-w-md font-display text-2xl md:text-3xl">
        {heading}
      </h3>
      <p
        className={
          "mt-3 max-w-md " +
          (dark ? "text-[color:var(--color-paper)]/80" : "text-[color:var(--color-ink-soft)]")
        }
      >
        {body}
      </p>
      <Link
        href={cta.href}
        className={
          "mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-5 py-2.5 text-sm font-medium transition-colors " +
          (dark
            ? "bg-[color:var(--color-paper)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-accent-tint)]"
            : "bg-[color:var(--color-ink)] text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)]")
        }
      >
        {cta.label}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
