import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { dataProvider } from "@/lib/data/provider";
import { FileUp, FileText, ShieldCheck } from "lucide-react";

const MOCK_HANDLE = "andile-z";

export default async function QualificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;

  const t = await getTranslations("seekerDash.qualifications");
  const items = me.qualifications ?? [];

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="qualifications"
      pageEyebrow="Credentials"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="primary" size="md">
          <FileUp className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-3">
        {/* Upload + verification info */}
        <section className="rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-6 md:col-span-1">
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            How verification works
          </div>
          <h2 className="mt-2 font-display text-xl">
            Default state is unverified.
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand)]" aria-hidden="true" />
              <span>Upload an original certificate (PDF or image, max 10MB).</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand)]" aria-hidden="true" />
              <span>Our admin queue or a SAQA partner verifies authenticity.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand)]" aria-hidden="true" />
              <span>Files live in a private R2 bucket — every reveal is audit-logged.</span>
            </li>
          </ul>
          <p className="mt-5 text-xs text-[color:var(--color-ink-soft)]">
            {t("verificationBy")} <strong>Sebenza admin (Phase 7)</strong> ·
            partner SAQA integration in Phase 8.
          </p>
        </section>

        {/* List */}
        <div className="md:col-span-2">
          {items.length === 0 ? (
            <EmptyState
              title={t("empty")}
              action={
                <Button variant="primary" size="md">
                  <FileUp className="size-4" aria-hidden="true" />
                  {t("add")}
                </Button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {items.map((q, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
                    <FileText className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="font-display text-lg">{q.title}</div>
                    <div className="text-sm text-[color:var(--color-ink-soft)]">
                      {q.institution}
                      {q.awardedYear ? ` · ${q.awardedYear}` : ""}
                    </div>
                  </div>
                  <VerificationBadge state={q.verification} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
