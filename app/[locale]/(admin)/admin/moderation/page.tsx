import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { listOpenReports } from "@/lib/admin/moderation-query";
import { ReportActions } from "@/components/feature/admin/ReportActions";
import { Flag } from "lucide-react";

const REASON_LABEL_KEY: Record<
  "fake_identity" | "inappropriate" | "harassment" | "spam" | "other",
  "fakeIdentity" | "inappropriate" | "harassment" | "spam" | "other"
> = {
  fake_identity: "fakeIdentity",
  inappropriate: "inappropriate",
  harassment: "harassment",
  spam: "spam",
  other: "other",
};

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();
  const t = await getTranslations("adminDash.moderation");
  const reports = await listOpenReports();

  const relTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  function relative(at: Date): string {
    const diffMs = Date.now() - at.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return relTime.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return relTime.format(-hrs, "hour");
    return relTime.format(-Math.round(hrs / 24), "day");
  }

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="moderation"
      pageEyebrow="Queue"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {reports.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
          No open reports. When a public visitor or signed-in user flags a
          profile from /p/[handle], it lands here.
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const reasonKey = REASON_LABEL_KEY[r.reason] ?? "other";
            return (
              <li
                key={r.id}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Flag
                      className="size-4 text-[color:var(--color-danger)]"
                      aria-hidden="true"
                    />
                    <span className="font-display text-lg">@{r.subjectHandle}</span>
                    <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)]">
                      {t(`reasons.${reasonKey}`)}
                    </span>
                    <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-danger)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-white">
                      {r.totalAgainstSubject}{" "}
                      {r.totalAgainstSubject === 1 ? "report" : "reports"}
                    </span>
                  </div>
                  <span className="text-xs text-[color:var(--color-ink-soft)]">
                    {t("reportedWhen", { when: relative(r.createdAt) })}
                  </span>
                </header>
                {r.note && (
                  <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                    {r.note}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/p/${r.subjectHandle}`}
                    className="text-sm text-[color:var(--color-brand)] hover:underline"
                  >
                    Open profile →
                  </Link>
                  <span className="flex-1" />
                  <ReportActions
                    reportId={r.id}
                    subjectUserId={r.subjectUserId}
                    subjectHandle={r.subjectHandle}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
