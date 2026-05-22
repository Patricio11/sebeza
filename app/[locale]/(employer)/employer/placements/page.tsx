import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { Button } from "@/components/ui/Button";
import { Plus, CheckCircle2 } from "lucide-react";

interface Placement {
  candidate: string;
  role: string;
  city: string;
  hiredAt: string;
  salaryBand: string;
}

const PLACEMENTS: Placement[] = [
  {
    candidate: "Thandeka M.",
    role: "Senior Pastry Chef",
    city: "Cape Town",
    hiredAt: "2026-05-04",
    salaryBand: "R 28k – R 35k / month",
  },
  {
    candidate: "Kabelo M.",
    role: "Site electrician",
    city: "Pretoria",
    hiredAt: "2026-04-18",
    salaryBand: "R 18k – R 22k / month",
  },
];

export default async function PlacementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("employerDash.placements");
  const tOuter = await getTranslations("employerDash");

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="placements"
      pageEyebrow="Analytics fuel"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="primary" size="md">
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
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
              <th className="px-5 py-3 font-normal">{t("fields.candidate")}</th>
              <th className="px-5 py-3 font-normal">{t("fields.role")}</th>
              <th className="px-5 py-3 font-normal">{t("fields.city")}</th>
              <th className="px-5 py-3 font-normal">{t("fields.hiredAt")}</th>
              <th className="px-5 py-3 font-normal">{t("fields.salaryBand")}</th>
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {PLACEMENTS.map((p, i) => (
              <tr key={i} className="border-t border-[color:var(--color-hairline)]">
                <td className="px-5 py-3 font-display text-base">{p.candidate}</td>
                <td className="px-5 py-3">{p.role}</td>
                <td className="px-5 py-3">{p.city}</td>
                <td className="px-5 py-3 tabular text-[color:var(--color-ink-soft)]">
                  {p.hiredAt}
                </td>
                <td className="px-5 py-3 text-[color:var(--color-ink-soft)]">
                  {p.salaryBand}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Logged
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {PLACEMENTS.map((p, i) => (
          <li
            key={i}
            className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-lg leading-tight">
                  {p.candidate}
                </div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {p.role}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Logged
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  {t("fields.city")}
                </dt>
                <dd>{p.city}</dd>
              </div>
              <div>
                <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  {t("fields.hiredAt")}
                </dt>
                <dd className="tabular">{p.hiredAt}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  {t("fields.salaryBand")}
                </dt>
                <dd className="text-[color:var(--color-ink-soft)]">
                  {p.salaryBand}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        Placements feed the national placement analytics (Phase 6) and the
        skills-gap engine. Salary bands stay private to your organisation.
      </p>
    </DashboardShell>
  );
}
