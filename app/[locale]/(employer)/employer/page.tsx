import { setRequestLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { TalentRosterItem } from "@/components/ui/TalentRosterItem";
import { dataProvider } from "@/lib/data/provider";
import { verifyEmployer } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { CheckCircle2 } from "lucide-react";

export default async function EmployerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const t = await getTranslations("employerDash");

  // ── Real KPIs ────────────────────────────────────────────────────────────
  const db = getDb();
  const orgId = session.orgId;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [savedCount, poolsCount, revealsThisMonth, placementsThisMonth] =
    orgId
      ? await Promise.all([
          db
            .select({ c: sql<number>`COUNT(*)::int` })
            .from(schema.savedSearches)
            .where(eq(schema.savedSearches.organizationId, orgId))
            .then((r) => r[0]?.c ?? 0),
          db
            .select({ c: sql<number>`COUNT(*)::int` })
            .from(schema.shortlistPools)
            .where(eq(schema.shortlistPools.organizationId, orgId))
            .then((r) => r[0]?.c ?? 0),
          db
            .select({ c: sql<number>`COUNT(*)::int` })
            .from(schema.auditLog)
            .where(
              and(
                eq(schema.auditLog.kind, "profile.contact.reveal"),
                sql`${schema.auditLog.at} >= ${monthStart}`,
                sql`${schema.auditLog.meta}->>'orgId' = ${orgId}`,
              ),
            )
            .then((r) => r[0]?.c ?? 0),
          db
            .select({ c: sql<number>`COUNT(*)::int` })
            .from(schema.placements)
            .where(
              and(
                eq(schema.placements.organizationId, orgId),
                sql`${schema.placements.hiredAt} >= ${monthStart}`,
              ),
            )
            .then((r) => r[0]?.c ?? 0),
        ])
      : [0, 0, 0, 0];

  // ── Recent matches preview (live search) ─────────────────────────────────
  const search = await dataProvider.searchProfiles({
    query: "developer",
    province: "gauteng",
  });
  const recent = search.profiles.slice(0, 3);

  // ── Recent placements (this org) ─────────────────────────────────────────
  const recentPlacements = orgId
    ? await db
        .select({
          id: schema.placements.id,
          role: schema.placements.role,
          city: schema.placements.city,
          hiredAt: schema.placements.hiredAt,
          handle: schema.profiles.handle,
          displayName: schema.profiles.displayName,
        })
        .from(schema.placements)
        .innerJoin(
          schema.profiles,
          eq(schema.profiles.id, schema.placements.profileId),
        )
        .where(eq(schema.placements.organizationId, orgId))
        .orderBy(desc(schema.placements.hiredAt))
        .limit(3)
    : [];

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="overview"
      pageEyebrow={`${session.name || MOCK_EMPLOYER.user.fullName}`}
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
        session.verification !== "verified" ? (
          <OrgVerificationBanner
            message={t("orgUnverifiedBanner")}
            cta={t("orgUnverifiedCta")}
          />
        ) : null
      }
    >
      {/* KPIs  live from DB */}
      <section
        aria-label="Headline numbers"
        className="grid gap-4 md:grid-cols-4"
      >
        <KPI
          label={t("overview.kpis.openSearches")}
          value={String(savedCount)}
          hint="saved filter sets"
        />
        <KPI
          label={t("overview.kpis.talentPools")}
          value={String(poolsCount)}
          hint="shortlist pools"
        />
        <KPI
          label={t("overview.kpis.revealsThisMonth")}
          value={String(revealsThisMonth)}
          hint="all audit-logged"
        />
        <KPI
          label={t("overview.kpis.placements")}
          value={String(placementsThisMonth)}
          hint={monthStart.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        />
      </section>

      {/* Recent matches  live search */}
      <section className="mt-12" aria-labelledby="recent-h">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[color:var(--color-ink)] pb-3">
          <h2 id="recent-h" className="font-display text-2xl">
            {t("overview.recent")}  Software Developer, Gauteng
          </h2>
          <Link
            href={{
              pathname: "/search",
              query: { query: "developer", province: "gauteng" },
            }}
            className="text-sm text-[color:var(--color-brand)] hover:underline"
          >
            {t("overview.refineInSearch")}
          </Link>
        </header>
        <ol className="border-t border-[color:var(--color-hairline)]">
          {recent.map((p) => (
            <li key={p.handle}>
              <TalentRosterItem profile={p} locale={locale} />
              <div className="-mt-2 mb-4 ml-16 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-3 py-2 text-sm">
                <span className="text-[color:var(--color-brand-strong)]">
                  <CheckCircle2
                    className="mr-1.5 inline size-3.5"
                    aria-hidden="true"
                  />
                  {t("overview.placementNudge")}
                </span>
                <Link
                  href={`/employer/dossier/${p.handle}`}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-brand)] px-4 py-1.5 text-xs font-medium text-white"
                >
                  Open dossier
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Recent placements */}
      {recentPlacements.length > 0 && (
        <section className="mt-12" aria-labelledby="rp-h">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[color:var(--color-ink)] pb-3">
            <h2 id="rp-h" className="font-display text-2xl">
              Your recent placements
            </h2>
            <Link
              href="/employer/placements"
              className="text-sm text-[color:var(--color-brand)] hover:underline"
            >
              All placements →
            </Link>
          </header>
          <ol className="divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            {recentPlacements.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/employer/dossier/${p.handle}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {p.displayName}
                  </Link>
                  <span className="text-xs text-[color:var(--color-ink-soft)]">
                    {p.role} · {p.city}
                  </span>
                </div>
                <span className="text-xs tabular text-[color:var(--color-ink-soft)]">
                  {p.hiredAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Quick links */}
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
          body="Log a hire  feeds national analytics."
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
  href:
    | "/employer/saved-searches"
    | "/employer/shortlists"
    | "/employer/placements"
    | "/employer/organisation";
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
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          →
        </span>
      </div>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{body}</p>
    </Link>
  );
}
