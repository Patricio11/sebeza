import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { lmiWithTrend } from "@/lib/analytics/lmi";
import { skillsGapQuery, freshnessBreakdownQuery } from "@/db/queries/analytics";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { getSetting } from "@/lib/admin/settings";
import { ArrowDown, ArrowUp, Minus, MapPin, Download } from "lucide-react";

export const revalidate = 300;

export default async function GovOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await verifyGov();

  const [freshDays, ageingDays] = await Promise.all([
    getSetting<number>("freshness_band_days_fresh"),
    getSetting<number>("freshness_band_days_ageing"),
  ]);
  const [lmi, gap, freshness, outcomes] = await Promise.all([
    lmiWithTrend(),
    skillsGapQuery({ top: 10 }),
    freshnessBreakdownQuery({ freshDays, ageingDays }),
    outcomesQuery(),
  ]);

  const nfmt = new Intl.NumberFormat(locale);
  const lmiDelta = lmi.previous
    ? lmi.current.value - lmi.previous.value
    : null;

  return (
    <DashboardShell
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="overview"
      pageEyebrow="National signal"
      pageTitle="Sebenza Labour Market Index"
      pageSubtitle="One number, three components. Updated nightly. Not an official Stats SA statistic — opinionated index, formula published."
      pageActions={
        <Link
          href="/api/lmi"
          prefetch={false}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm font-medium hover:border-[color:var(--color-ink)]"
        >
          <Download className="size-4" aria-hidden="true" />
          JSON
        </Link>
      }
    >
      {/* LMI hero */}
      <section className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-6 md:p-10">
        <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
          Sebenza LMI · this week
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-4">
          <span className="font-display tabular text-[clamp(3.5rem,8vw,6rem)] leading-none">
            {lmi.current.value.toFixed(2)}
          </span>
          {lmiDelta != null && (
            <span
              className={
                "inline-flex items-center gap-1 text-base " +
                (lmiDelta > 0
                  ? "text-[color:var(--color-employed)]"
                  : lmiDelta < 0
                    ? "text-[color:var(--color-danger)]"
                    : "text-[color:var(--color-ink-soft)]")
              }
            >
              {lmiDelta > 0 ? (
                <ArrowUp className="size-4" aria-hidden="true" />
              ) : lmiDelta < 0 ? (
                <ArrowDown className="size-4" aria-hidden="true" />
              ) : (
                <Minus className="size-4" aria-hidden="true" />
              )}
              {lmiDelta > 0 ? "+" : ""}
              {lmiDelta.toFixed(2)} vs last snapshot
            </span>
          )}
        </div>
        <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
          <Stat
            label="Freshness ratio (40% weight)"
            value={lmi.current.components.freshnessRatio.toFixed(2)}
            hint="fresh profiles ÷ total active"
          />
          <Stat
            label="Met demand (40% weight)"
            value={lmi.current.components.metDemand.toFixed(2)}
            hint="1 − unfilled-demand share"
          />
          <Stat
            label="Placement velocity (20% weight)"
            value={lmi.current.components.placementVelocity.toFixed(2)}
            hint="confirmed hires / active pool ÷ saturation"
          />
        </dl>
      </section>

      {/* Top 10 provincial gaps */}
      <section className="mt-12">
        <header className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-[color:var(--color-ink)] pb-2">
          <h2 className="font-display text-2xl">Top unfilled-demand skills</h2>
          <Link
            href="/gov/provinces"
            className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
          >
            Per-province deep dives →
          </Link>
        </header>
        <ul className="divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          {gap.slice(0, 10).map((g) => (
            <li
              key={g.skill}
              className="flex items-baseline justify-between gap-3 px-5 py-3 text-sm"
            >
              <span className="font-display text-base">{g.skill}</span>
              <span className="text-right">
                <span className="text-[color:var(--color-danger)] font-mono tabular">
                  gap {nfmt.format(g.gap)}
                </span>
                <span className="ml-2 text-[color:var(--color-ink-soft)]">
                  · {nfmt.format(g.matches)} active
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Freshness summary */}
      <section className="mt-12 grid gap-3 md:grid-cols-3">
        <Tile
          label="Fresh"
          value={nfmt.format(freshness.fresh)}
          hint={`Within ${freshDays} days`}
        />
        <Tile
          label="Ageing"
          value={nfmt.format(freshness.ageing)}
          hint={`${freshDays}–${ageingDays} days`}
        />
        <Tile
          label="Stale"
          value={nfmt.format(freshness.stale)}
          hint={`${ageingDays}+ days · down-ranked`}
        />
      </section>

      {/* Longitudinal outcomes signpost */}
      <section className="mt-12 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
        <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
          <MapPin className="mr-1 inline size-3" aria-hidden="true" />
          Outcomes dataset
        </div>
        <h3 className="mt-1 font-display text-xl">
          {outcomes.cohorts.length} cohort{outcomes.cohorts.length === 1 ? "" : "s"} cleared the suppression floor
        </h3>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          {outcomes.consentedProfileCount} consented profile
          {outcomes.consentedProfileCount === 1 ? "" : "s"} contributing;
          floor k = {outcomes.minCohortSize}; {outcomes.suppressedCohorts}{" "}
          cell{outcomes.suppressedCohorts === 1 ? "" : "s"} suppressed (primary
          + complementary). Full table on{" "}
          <Link href="/insights" className="underline">
            /insights
          </Link>
          .
        </p>
      </section>
    </DashboardShell>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="mt-1 font-display tabular text-3xl text-[color:var(--color-ink)]">
        {value}
      </dd>
      <p className="text-xs text-[color:var(--color-ink-soft)]">{hint}</p>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 font-display tabular text-3xl">{value}</div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{hint}</p>
    </div>
  );
}
