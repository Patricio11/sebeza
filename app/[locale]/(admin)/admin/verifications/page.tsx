import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  listPendingQualifications,
  listPendingOrganisations,
} from "@/lib/admin/verifications-query";
import { VerificationActions } from "@/components/feature/admin/VerificationActions";
import { FileText } from "lucide-react";

export default async function VerificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const { tab } = await searchParams;
  const active = tab === "organisations" ? "organisations" : "qualifications";

  const t = await getTranslations("adminDash.verifications");
  const [quals, orgs] = await Promise.all([
    listPendingQualifications(),
    listPendingOrganisations(),
  ]);

  const relTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  function relative(d: Date | string | null | undefined): string {
    if (!d) return "—";
    const at = typeof d === "string" ? new Date(d) : d;
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
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="verifications"
      pageEyebrow="Queue"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Tabs */}
      <nav className="mb-6 flex gap-1 border-b border-[color:var(--color-hairline)]">
        <TabLink
          active={active === "qualifications"}
          href={{ pathname: "/admin/verifications", query: { tab: "qualifications" } }}
          label={`${t("tabs.qualifications")} · ${quals.length}`}
        />
        <TabLink
          active={active === "organisations"}
          href={{ pathname: "/admin/verifications", query: { tab: "organisations" } }}
          label={`${t("tabs.organisations")} · ${orgs.length}`}
        />
      </nav>

      {active === "qualifications" ? (
        quals.length === 0 ? (
          <EmptyQueue
            title="Nothing pending."
            note="When seekers upload qualification evidence, submissions appear here."
          />
        ) : (
          <ul className="space-y-3">
            {quals.map((q) => (
              <li
                key={q.id}
                className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[auto_1fr_auto] md:items-center"
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
                  <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                    {t("submittedBy")}{" "}
                    {q.handle ? (
                      <Link
                        href={`/p/${q.handle}`}
                        className="text-[color:var(--color-brand)] hover:underline"
                      >
                        {q.candidateName}
                      </Link>
                    ) : (
                      <span>{q.candidateName}</span>
                    )}
                  </div>
                </div>
                <VerificationActions
                  id={q.id}
                  kind="qualification"
                  approveLabel={t("approve")}
                  rejectLabel={t("reject")}
                />
              </li>
            ))}
          </ul>
        )
      ) : orgs.length === 0 ? (
        <EmptyQueue
          title="No organisations awaiting verification."
          note="New employers will appear here after sign-up."
        />
      ) : (
        <ul className="space-y-3">
          {orgs.map((o) => (
            <li
              key={o.id}
              className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg">{o.name}</span>
                  <VerificationBadge state="pending" />
                </div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {o.registrationNumber ? `CIPC ${o.registrationNumber}` : "No CIPC on file"}
                  {o.industry ? ` · ${o.industry}` : ""}
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  Submitted {relative(o.createdAt)}
                </div>
              </div>
              <VerificationActions
                id={o.id}
                kind="organisation"
                approveLabel={t("approve")}
                rejectLabel={t("reject")}
              />
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: { pathname: "/admin/verifications"; query: { tab: string } };
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        "border-b-2 px-4 py-2.5 text-sm uppercase tracking-[0.18em] " +
        (active
          ? "border-[color:var(--color-ink)] text-[color:var(--color-ink)]"
          : "border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
      }
    >
      {label}
    </Link>
  );
}

function EmptyQueue({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-sm text-[color:var(--color-ink-soft)]">
      <p className="font-display text-lg text-[color:var(--color-ink)]">{title}</p>
      <p className="mt-1">{note}</p>
    </div>
  );
}
