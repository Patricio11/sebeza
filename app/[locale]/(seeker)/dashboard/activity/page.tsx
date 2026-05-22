import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { dataProvider } from "@/lib/data/provider";
import { verifyRole } from "@/lib/auth/dal";
import { Eye, MessageCircle, FileText, Download } from "lucide-react";

const MOCK_HANDLE = "andile-z";

interface FeedItem {
  kind: "view" | "contact" | "reveal" | "download";
  when: string;
  who: string;
  detail: string;
}

const MOCK_FEED: FeedItem[] = [
  { kind: "view", when: "2 hours ago", who: "Discovery Bank · Recruiter (verified)", detail: "Viewed full dossier · Sandton office" },
  { kind: "contact", when: "Yesterday", who: "Discovery Bank", detail: 'Requested contact reveal for "Senior engineer — Sandton"' },
  { kind: "reveal", when: "Yesterday", who: "Discovery Bank", detail: "Contact details revealed (consent on file v2.1)" },
  { kind: "view", when: "Yesterday", who: "Yoco · Talent partner (verified)", detail: "Viewed public profile" },
  { kind: "view", when: "3 days ago", who: "Wits Health Sciences (verified)", detail: "Viewed public profile" },
  { kind: "download", when: "5 days ago", who: "Mr Price Foundation (verified)", detail: "Downloaded BSc Computer Science certificate" },
];

const ICONS = {
  view: Eye,
  contact: MessageCircle,
  reveal: FileText,
  download: Download,
} as const;

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("seeker");
  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;
  const t = await getTranslations("seekerDash.activity");

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="activity"
      pageEyebrow="Audit ledger · your view"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <KPI label={t("viewers")} value={14} delta="+3 this week" />
        <KPI label={t("contacts")} value={3} delta="+1 this week" />
        <KPI label={t("reveals")} value={2} delta="" />
        <KPI label={t("downloads")} value={1} delta="" />
      </div>

      <ol className="mt-10 divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
        {MOCK_FEED.map((item, i) => {
          const Icon = ICONS[item.kind];
          return (
            <li key={i} className="grid grid-cols-[auto_auto_1fr] gap-4 px-5 py-4">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] md:w-28">
                {item.when}
              </span>
              <span
                aria-hidden="true"
                className="inline-flex size-7 items-center justify-center rounded-full bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]"
              >
                <Icon className="size-3.5" />
              </span>
              <div>
                <div className="text-sm font-medium text-[color:var(--color-ink)]">
                  {item.who}
                </div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">
                  {item.detail}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-xs italic text-[color:var(--color-ink-soft)]">
        Every event above is also stored in the platform audit log under POPIA
        retention policy. You can export your own ledger any time from Privacy &
        consent.
      </p>
    </DashboardShell>
  );
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
