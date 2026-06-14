import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { recentAuditEventsFromDb } from "@/lib/audit";
import { verifyAdmin } from "@/lib/auth/dal";
import { adminOverviewCounts } from "@/lib/admin/users";
import { ShieldCheck, Flag, Users, ScrollText } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();

  const t = await getTranslations("adminDash");
  const [counts, events] = await Promise.all([
    adminOverviewCounts(),
    recentAuditEventsFromDb(8),
  ]);

  const pendingVerifications = counts.pendingQualifications + counts.pendingOrganisations;
  const relTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  function relative(at: string): string {
    const diffMs = Date.now() - new Date(at).getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return relTime.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return relTime.format(-hrs, "hour");
    return relTime.format(-Math.round(hrs / 24), "day");
  }

  return (
    <DashboardMasthead
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="overview"
      pageEyebrow="Trust & integrity"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.3  help deep-links (D6 mirror from employer + seeker). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="admin" slug="what-sebenza-is-for-admins" label="Console orientation" />
        <HelpLink role="admin" slug="admin-dashboard-tour" label="Dashboard tour" />
        <HelpLink role="admin" slug="troubleshooting-common-issues" label="Troubleshooting" />
      </div>

      {/* KPI strip */}
      <section className="grid gap-4 md:grid-cols-4">
        <KPI
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.pendingVerifications")}
          value={String(pendingVerifications)}
          tone="accent"
          href="/admin/verifications"
        />
        <KPI
          icon={<Flag className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.openReports")}
          value={String(counts.openReports)}
          tone="danger"
          href="/admin/moderation"
        />
        <KPI
          icon={<Users className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.newUsersWeek")}
          value={String(counts.newUsers7d)}
          tone="brand"
        />
        <KPI
          icon={<ScrollText className="size-4" aria-hidden="true" />}
          label={t("overview.kpis.auditEvents24h")}
          value={String(counts.auditEvents24h)}
          tone="ink"
          href="/admin/audit-log"
        />
      </section>

      {/* Active queues */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <QueueCard
          eyebrow="Queue"
          title="Qualifications awaiting review"
          count={counts.pendingQualifications}
          hint={
            counts.pendingQualifications === 0
              ? "Nothing pending."
              : `${counts.pendingQualifications} submission(s) waiting.`
          }
          href="/admin/verifications"
        />
        <QueueCard
          eyebrow="Queue"
          title="Organisations awaiting verification"
          count={counts.pendingOrganisations}
          hint={
            counts.pendingOrganisations === 0
              ? "Nothing pending."
              : `${counts.pendingOrganisations} organisation(s) waiting.`
          }
          href="/admin/verifications"
        />
        <QueueCard
          eyebrow="Queue"
          title="Reported profiles"
          count={counts.openReports}
          hint={
            counts.openReports === 0
              ? "No open reports."
              : `${counts.openReports} open report(s).`
          }
          href="/admin/moderation"
        />
        <QueueCard
          eyebrow="Lifecycle"
          title="Suspended accounts"
          count={counts.suspendedUsers}
          hint={
            counts.suspendedUsers === 0
              ? "No accounts suspended."
              : "Filter by suspended on /admin/users."
          }
          href="/admin/users"
        />
      </section>

      {/* Recent admin actions */}
      <section className="mt-12">
        <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl">
          {t("overview.recent")}
        </h2>
        {events.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
            No admin activity yet. Every action you take here will appear in the
            audit ledger.
          </p>
        ) : (
          <ol className="divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            {events.map((e, i) => (
              <RecentRow
                key={i}
                when={relative(e.at)}
                who={e.actor === "anonymous" ? "Anonymous" : e.actor}
                detail={`${e.kind}${e.subject ? ` · ${e.subject}` : ""}`}
              />
            ))}
          </ol>
        )}
      </section>
    </DashboardMasthead>
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
  href: "/admin/verifications" | "/admin/moderation" | "/admin/taxonomy" | "/admin/users";
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
        <span className="text-[color:var(--color-ink-soft)]"> {detail}</span>
      </span>
    </li>
  );
}
