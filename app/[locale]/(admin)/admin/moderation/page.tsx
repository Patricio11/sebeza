import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { Button } from "@/components/ui/Button";
import { Flag } from "lucide-react";

type Reason = "fakeIdentity" | "inappropriate" | "harassment" | "spam";

interface Report {
  handle: string;
  candidate: string;
  reason: Reason;
  reports: number;
  reported: string;
  note: string;
}

const REPORTS: Report[] = [
  { handle: "suspect-account", candidate: "Anonymised", reason: "spam", reports: 3, reported: "2 hours ago", note: "Profile bio matches three other recently-removed accounts; suspected mass-signup script." },
  { handle: "fake-cv", candidate: "Anonymised", reason: "fakeIdentity", reports: 1, reported: "Yesterday", note: "Reporter claims qualifications copied from another LinkedIn profile." },
  { handle: "harasser-1", candidate: "Anonymised", reason: "harassment", reports: 2, reported: "3 days ago", note: "Two seekers report unsolicited contact via fraudulent reveals." },
];

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminDash.moderation");

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="moderation"
      pageEyebrow="Queue"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <ul className="space-y-4">
        {REPORTS.map((r, i) => (
          <li
            key={i}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flag
                  className="size-4 text-[color:var(--color-danger)]"
                  aria-hidden="true"
                />
                <span className="font-display text-lg">
                  @{r.handle}
                </span>
                <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)]">
                  {t(`reasons.${r.reason}`)}
                </span>
                <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-danger)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-white">
                  {r.reports} {r.reports === 1 ? "report" : "reports"}
                </span>
              </div>
              <span className="text-xs text-[color:var(--color-ink-soft)]">
                {t("reportedWhen", { when: r.reported })}
              </span>
            </header>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {r.note}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/p/${r.handle}`}
                className="text-sm text-[color:var(--color-brand)] hover:underline"
              >
                Open profile →
              </Link>
              <span className="flex-1" />
              <Button variant="ghost" size="sm">{t("closeNoAction")}</Button>
              <Button variant="secondary" size="sm">{t("restore")}</Button>
              <Button
                type="button"
                size="sm"
                className="bg-[color:var(--color-danger)] text-white hover:opacity-90"
              >
                {t("suspend")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
