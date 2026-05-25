import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { Button } from "@/components/ui/Button";
import { verifyEmployer } from "@/lib/auth/dal";
import { Plus, MoreVertical } from "lucide-react";

interface Member {
  name: string;
  email: string;
  role: "owner" | "recruiter" | "viewer";
  twoFa: boolean;
  joined: string;
}

const MEMBERS: Member[] = [
  { name: "Naledi Khumalo", email: "naledi.khumalo@discovery.co.za", role: "owner", twoFa: true, joined: "Jan 2024" },
  { name: "Daniel Schaefer", email: "daniel.schaefer@discovery.co.za", role: "recruiter", twoFa: true, joined: "Mar 2024" },
  { name: "Aisha Patel", email: "aisha.patel@discovery.co.za", role: "recruiter", twoFa: false, joined: "Apr 2024" },
  { name: "Mike van Schalkwyk", email: "mike.vs@discovery.co.za", role: "viewer", twoFa: true, joined: "May 2024" },
];

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Phase 9.10  use verifyEmployer (permissive) for the live
  // org context (orgName etc). NB: the MEMBERS list below is still
  // hardcoded mock data  that's a separate post-launch backlog
  // item (the team page should read organization_members + app_user).
  const session = await verifyEmployer();
  const t = await getTranslations("employerDash.team");
  const tOuter = await getTranslations("employerDash");

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="team"
      pageEyebrow="People"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="primary" size="md">
          <Plus className="size-4" aria-hidden="true" />
          {t("invite")}
        </Button>
      }
      banner={
        <OrgVerificationBanner
          message={tOuter("orgUnverifiedBanner")}
          cta={tOuter("orgUnverifiedCta")}
        />
      }
    >
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              <th className="px-5 py-3 font-normal">Member</th>
              <th className="px-5 py-3 font-normal">{t("role")}</th>
              <th className="px-5 py-3 font-normal">2FA</th>
              <th className="px-5 py-3 font-normal">Joined</th>
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((m) => (
              <tr key={m.email} className="border-t border-[color:var(--color-hairline)]">
                <td className="px-5 py-3">
                  <div className="font-display text-base">{m.name}</div>
                  <div className="text-xs text-[color:var(--color-ink-soft)]">
                    {m.email}
                  </div>
                </td>
                <td className="px-5 py-3 capitalize">
                  <span
                    className={
                      "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
                      (m.role === "owner"
                        ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                        : m.role === "recruiter"
                          ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                          : "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]")
                    }
                  >
                    {t(m.role)}
                  </span>
                </td>
                <td className="px-5 py-3 text-[color:var(--color-ink-soft)]">
                  {m.twoFa ? (
                    <span className="text-[color:var(--color-employed)]">Active</span>
                  ) : (
                    <span className="text-[color:var(--color-danger)]">Required  not set</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[color:var(--color-ink-soft)]">{m.joined}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    aria-label="Member actions"
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {MEMBERS.map((m) => (
          <li
            key={m.email}
            className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-lg leading-tight">
                  {m.name}
                </div>
                <div className="truncate text-xs text-[color:var(--color-ink-soft)]">
                  {m.email}
                </div>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
                  (m.role === "owner"
                    ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                    : m.role === "recruiter"
                      ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                      : "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]")
                }
              >
                {t(m.role)}
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
              <div>
                <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  2FA
                </span>{" "}
                {m.twoFa ? (
                  <span className="text-[color:var(--color-employed)]">
                    Active
                  </span>
                ) : (
                  <span className="text-[color:var(--color-danger)]">
                    Required  not set
                  </span>
                )}
              </div>
              <span className="text-[color:var(--color-ink-soft)]">
                Joined {m.joined}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        Every member&apos;s access to candidate PII is audit-logged separately.
        Suspend a member to immediately revoke their reveal capabilities.
      </p>
    </DashboardShell>
  );
}
