/**
 * Phase 9.8.1  Create vacancy page (`/employer/vacancies/new`).
 *
 * Server-rendered shell + client form island. Owners + Recruiters only;
 * Viewers get bounced to the list. Taxonomy fetched server-side so the
 * client form receives a stable list without re-fetching.
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";
import { createVacancy, getMyOrgRole } from "@/lib/employer/vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import { VacancyForm } from "@/components/feature/employer/vacancies/VacancyForm";
import { getProfessions } from "@/lib/taxonomy/query";
import { PROVINCES, SKILLS } from "@/lib/mock/taxonomy";

export const revalidate = 0;

export default async function NewVacancyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    redirect("/employer/vacancies");
  }

  const professions = await getProfessions();

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="vacancies"
      pageEyebrow={session.name ?? "Employer workspace"}
      pageTitle="New vacancy"
      pageSubtitle="Private to your organisation. Vacancies start as drafts  open them when ready to invite candidates."
    >
      <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-8">
        <VacancyForm
          professions={professions}
          provinces={PROVINCES}
          skills={SKILLS}
          onSubmit={async (value) => {
            "use server";
            const res = await createVacancy(value);
            return res.ok
              ? { ok: true }
              : { ok: false, message: res.message };
          }}
          redirectTo="/employer/vacancies"
          submitLabel="Create vacancy"
        />
      </div>
    </DashboardShell>
  );
}
