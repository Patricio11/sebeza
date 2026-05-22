import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { Button } from "@/components/ui/Button";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { FileText, Eye } from "lucide-react";

interface QualSubmission {
  handle: string;
  candidate: string;
  title: string;
  institution: string;
  awardedYear: number;
  submitted: string;
}

interface OrgSubmission {
  org: string;
  registration: string;
  industry: string;
  submitted: string;
}

const QUALS: QualSubmission[] = [
  { handle: "thandeka-m", candidate: "Thandeka M.", title: "Diploma in Culinary Arts", institution: "Capsicum Culinary Studio", awardedYear: 2014, submitted: "2 days ago" },
  { handle: "kabelo-m", candidate: "Kabelo M.", title: "Trade Test: Electrician", institution: "INDLELA", awardedYear: 2019, submitted: "Yesterday" },
  { handle: "lerato-n", candidate: "Lerato N.", title: "BSc Computer Science", institution: "University of the Witwatersrand", awardedYear: 2018, submitted: "4 hours ago" },
];

const ORGS: OrgSubmission[] = [
  { org: "Discovery Bank", registration: "1996/004593/06", industry: "Financial services", submitted: "4 hours ago" },
  { org: "La Colombe Restaurant", registration: "2008/123456/07", industry: "Hospitality", submitted: "Yesterday" },
];

export default async function VerificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tab } = await searchParams;
  const active = tab === "organisations" ? "organisations" : "qualifications";

  const t = await getTranslations("adminDash.verifications");

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
          label={`${t("tabs.qualifications")} · ${QUALS.length}`}
        />
        <TabLink
          active={active === "organisations"}
          href={{ pathname: "/admin/verifications", query: { tab: "organisations" } }}
          label={`${t("tabs.organisations")} · ${ORGS.length}`}
        />
      </nav>

      {active === "qualifications" ? (
        <ul className="space-y-3">
          {QUALS.map((q, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[auto_1fr_auto] md:items-center"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="font-display text-lg">{q.title}</div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {q.institution} · {q.awardedYear}
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {t("submittedBy")}{" "}
                  <Link
                    href={`/p/${q.handle}`}
                    className="text-[color:var(--color-brand)] hover:underline"
                  >
                    {q.candidate}
                  </Link>{" "}
                  · {t("submittedWhen", { when: q.submitted })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="size-4" aria-hidden="true" />
                  {t("viewEvidence")}
                </Button>
                <Button variant="primary" size="sm">{t("approve")}</Button>
                <Button variant="secondary" size="sm">{t("reject")}</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {ORGS.map((o, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg">{o.org}</span>
                  <VerificationBadge state="pending" />
                </div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  CIPC {o.registration} · {o.industry}
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {t("submittedWhen", { when: o.submitted })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="size-4" aria-hidden="true" />
                  {t("viewEvidence")}
                </Button>
                <Button variant="primary" size="sm">{t("approve")}</Button>
                <Button variant="secondary" size="sm">{t("reject")}</Button>
              </div>
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
