import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { recentAuditEventsFromDb } from "@/lib/audit";
import { ShieldCheck, Flag, Users, ScrollText } from "lucide-react";

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("adminDash");
  const events = await recentAuditEventsFromDb(8);

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="overview"
      pageEyebrow="Trust & integrity"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* KPI strip */}
      <section className="grid gap-4 md:grid-cols-4">
        <KPI
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.pendingVerifications")}
          value="14"
          tone="accent"
          href="/admin/verifications"
        />
        <KPI
          icon={<Flag className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.openReports")}
          value="3"
          tone="danger"
          href="/admin/moderation"
        />
        <KPI
          icon={<Users className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.newUsersWeek")}
          value="148"
          tone="brand"
        />
        <KPI
          icon={<ScrollText className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.auditEvents24h")}
          value={String(events.length || 0)}
          tone="ink"
          href="/admin/audit-log"
        />
      </section>

      {/* Active queues */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <QueueCard
          eyebrow="Queue"
          title="Qualifications awaiting review"
          count={9}
          hint="Oldest: 2 days · INDLELA trade test"
          href="/admin/verifications"
        />
        <QueueCard
          eyebrow="Queue"
          title="Organisations awaiting verification"
          count={5}
          hint="Oldest: 4 hours · Discovery Bank"
          href="/admin/verifications"
        />
        <QueueCard
          eyebrow="Queue"
          title="Reported profiles"
          count={3}
          hint="2 marked spam · 1 suspected fake identity"
          href="/admin/moderation"
        />
        <QueueCard
          eyebrow="Reference data"
          title="Taxonomy proposals"
          count={2}
          hint='"Embedded systems engineer" awaiting decision'
          href="/admin/taxonomy"
        />
      </section>

      {/* Recent admin actions */}
      <section className="mt-12">
        <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl">
          {t("overview.recent")}
        </h2>
        <ol className="divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          <RecentRow
            when="12 minutes ago"
            who="Sebenza · Admin"
            detail="Approved qualification · INDLELA trade test (Kabelo M.)"
          />
          <RecentRow
            when="2 hours ago"
            who="Sebenza · Admin"
            detail="Suspended user @suspect-account after spam report (3 reports)"
          />
          <RecentRow
            when="Yesterday"
            who="Sebenza · Admin"
            detail="Added profession: Embedded systems engineer"
          />
          <RecentRow
            when="3 days ago"
            who="Sebenza · Admin"
            detail="Exported aggregate insights CSV (audit-logged)"
          />
        </ol>
      </section>
    </DashboardShell>
  );
}

function KPI({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "accent" | "danger" | "brand" | "ink";
  href?: "/admin/verifications" | "/admin/moderation" | "/admin/audit-log";
}) {
  const stripe = {
    accent: "border-l-[color:var(--color-accent)]",
    danger: "border-l-[color:var(--color-danger)]",
    brand: "border-l-[color:var(--color-brand)]",
    ink: "border-l-[color:var(--color-ink)]",
  }[tone];

  const body = (
    <div
      className={`flex flex-col gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] border-l-4 ${stripe} bg-[color:var(--color-surface)] p-5`}
    >
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {icon}
        {label}
      </div>
      <div className="font-display tabular text-3xl text-[color:var(--color-ink)]">
        {value}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:translate-y-[-1px] transition-transform">
      {body}
    </Link>
  ) : (
    body
  );
}

function QueueCard({
  eyebrow,
  title,
  count,
  hint,
  href,
}: {
  eyebrow: string;
  title: string;
  count: number;
  hint: string;
  href: "/admin/verifications" | "/admin/moderation" | "/admin/taxonomy";
}) {
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 hover:border-[color:var(--color-ink)]"
    >
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {eyebrow}
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <h3 className="font-display text-xl">{title}</h3>
        <span className="font-display tabular text-3xl text-[color:var(--color-accent)]">
          {count}
        </span>
      </div>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{hint}</p>
    </Link>
  );
}

function RecentRow({
  when,
  who,
  detail,
}: {
  when: string;
  who: string;
  detail: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-4 px-5 py-3 text-sm">
      <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] md:w-32">
        {when}
      </span>
      <span>
        <span className="font-medium">{who}</span>{" "}
        <span className="text-[color:var(--color-ink-soft)]">— {detail}</span>
      </span>
    </li>
  );
}
