import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyProfile } from "@/lib/profile/me";
import { getSeekerActivity } from "@/lib/profile/activity";
import { formatRelativeTime } from "@/lib/utils";
import { Eye, MessageCircle, FileText, Download } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

const ICONS = {
  "profile.view": Eye,
  "profile.contact.request": MessageCircle,
  "profile.contact.reveal": FileText,
  "profile.document.download": Download,
} as const;

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/activity");

  const t = await getTranslations("seekerDash.activity");
  const { kpis, feed } = await getSeekerActivity(me);

  return (
    <DashboardMasthead
      role="seeker"
      pageEyebrow="Audit ledger · your view"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="understanding-your-activity-ledger" label="Reading your ledger" />
        <HelpLink role="seeker" slug="who-viewed-your-profile" label="Profile viewers" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPI label={t("viewers")} value={kpis.viewers} delta={formatDelta(kpis.viewersDelta)} />
        <KPI label={t("contacts")} value={kpis.contacts} delta={formatDelta(kpis.contactsDelta)} />
        <KPI label={t("reveals")} value={kpis.reveals} delta="" />
        <KPI label={t("downloads")} value={kpis.downloads} delta="" />
      </div>

      {feed.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No activity yet"
            body="Once verified employers view your profile, request your contact, or download your certificates, every event lands here. Each row is also written to the platform audit log under POPIA retention policy."
          />
        </div>
      ) : (
        <ol className="mt-10 divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
          {feed.map((item, i) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={i} className="grid grid-cols-[auto_auto_1fr] gap-4 px-5 py-4">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] md:w-28">
                  {formatRelativeTime(item.at, locale)}
                </span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 items-center justify-center rounded-full bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]"
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[color:var(--color-ink)]">
                    {item.actor}
                  </div>
                  <div className="text-xs text-[color:var(--color-ink-soft)]">
                    {item.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-6 text-xs italic text-[color:var(--color-ink-soft)]">
        Every event above is also stored in the platform audit log under POPIA
        retention policy. You can export your own ledger any time from{" "}
        <a className="underline" href="/dashboard/privacy">
          Privacy &amp; consent
        </a>
        .
      </p>
    </DashboardMasthead>
  );
}

function formatDelta(d: number | null): string {
  if (d === null) return "";
  if (d > 0) return `+${d} this week`;
  if (d < 0) return `${d} this week`;
  return "no change this week";
}

function KPI({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 font-display tabular text-3xl text-[color:var(--color-ink)]">
        {value}
      </div>
      {delta && (
        <div className="text-xs text-[color:var(--color-ink-soft)]">{delta}</div>
      )}
    </div>
  );
}
