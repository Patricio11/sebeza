import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { TalentRosterItem } from "@/components/ui/TalentRosterItem";
import { Button } from "@/components/ui/Button";
import { dataProvider } from "@/lib/data/provider";
import { verifyRole } from "@/lib/auth/dal";
import { CheckCircle2 } from "lucide-react";

export default async function EmployerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("employer");

  const t = await getTranslations("employerDash");
  const search = await dataProvider.searchProfiles({
    query: "developer",
    province: "gauteng",
    highlightCitizens: false,
  });
  const recent = search.profiles.slice(0, 2);

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="overview"
      pageEyebrow={`${MOCK_EMPLOYER.user.fullName} · ${MOCK_EMPLOYER.user.role}`}
      pageTitle={t("title")}
      pageSubtitle={`${MOCK_EMPLOYER.industry} · ${MOCK_EMPLOYER.city}, ${MOCK_EMPLOYER.country}`}
      pageActions={
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2 text-sm font-medium text-[color:var(--color-paper)]"
        >
          Search talent →
        </Link>
      }
      banner={
        <OrgVerificationBanner
          message={t("orgUnverifiedBanner")}
          cta={t("orgUnverifiedCta")}
        />
      }
    >
      {/* KPIs */}
      <section aria-label="Headline numbers" className="grid gap-4 md:grid-cols-4">
        <KPI label={t("overview.kpis.openSearches")} value="6" hint="+1 this week" />
        <KPI label={t("overview.kpis.talentPools")} value="3" hint="2 active" />
        <KPI label={t("overview.kpis.revealsThisMonth")} value="11" hint="all audit-logged" />
        <KPI label={t("overview.kpis.placements")} value="2" hint="May 2026" />
      </section>

      {/* Recent matches */}
      <section className="mt-12" aria-labelledby="recent-h">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[color:var(--color-ink)] pb-3">
          <h2 id="recent-h" className="font-display text-2xl">
            {t("overview.recent")} — Software Developer, Gauteng
          </h2>
          <Link
            href={{ pathname: "/search", query: { q: "developer", province: "gauteng" } }}
            className="text-sm text-[color:var(--color-brand)] hover:underline"
          >
            {t("overview.refineInSearch")}
          </Link>
        </header>
        <ol className="border-t border-[color:var(--color-hairline)]">
          {recent.map((p) => (
            <li key={p.handle}>
              <TalentRosterItem profile={p} locale={locale} />
              <PlacementNudge
                body={t("overview.placementNudge")}
                cta={t("overview.markHired")}
              />
            </li>
          ))}
        </ol>
      </section>

      {/* Pipeline + quick links */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <QuickLink
          title={t("nav.savedSearches")}
          href="/employer/saved-searches"
          body="Reusable filter sets, with new-match notifications."
        />
        <QuickLink
          title={t("nav.shortlists")}
          href="/employer/shortlists"
          body="Curated talent pools per campaign. Internal share only."
        />
        <QuickLink
          title={t("nav.placements")}
          href="/employer/placements"
          body="Log a hire — feeds national analytics, earns credits."
        />
        <QuickLink
          title={t("nav.organisation")}
          href="/employer/organisation"
          body="Submit for verification to unlock contact reveal."
        />
      </section>
    </DashboardShell>
  );
}

function KPI({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 font-display tabular text-3xl text-[color:var(--color-ink)]">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-[color:var(--color-ink-soft)]">{hint}</div>
      )}
    </div>
  );
}

function QuickLink({
  title,
  href,
  body,
}: {
  title: string;
  href: "/employer/saved-searches" | "/employer/shortlists" | "/employer/placements" | "/employer/organisation";
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 hover:border-[color:var(--color-ink)]"
    >
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        Workspace
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <h3 className="font-display text-lg">{title}</h3>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">→</span>
      </div>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{body}</p>
    </Link>
  );
}

function PlacementNudge({ body, cta }: { body: string; cta: string }) {
  return (
    <div className="-mt-2 mb-4 ml-16 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-3 py-2 text-sm">
      <span className="text-[color:var(--color-brand-strong)]">
        <CheckCircle2 className="mr-1.5 inline size-3.5" aria-hidden="true" />
        {body}
      </span>
      <Button type="button" variant="primary" size="sm">
        {cta}
      </Button>
    </div>
  );
}
