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
import {
  createVacancy,
  getMyOrgRole,
  getMyVacancy,
} from "@/lib/employer/vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import {
  VacancyForm,
  type VacancyFormValue,
} from "@/components/feature/employer/vacancies/VacancyForm";
import { getProfessions } from "@/lib/taxonomy/query";
import { PROVINCES, SKILLS } from "@/lib/mock/taxonomy";
import { HelpLink } from "@/components/feature/help/HelpLink";

export const revalidate = 0;

export default async function NewVacancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ duplicateFrom?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const role = await getMyOrgRole();
  if (!canEditVacancies(role)) {
    redirect("/employer/vacancies");
  }

  // Phase 9.19 D7  Duplicate from existing. The button on the
  // vacancy list passes ?duplicateFrom=<id>; we load that vacancy
  // (org-scoped via getMyVacancy) and pre-fill the form. The new
  // vacancy is its own draft  saving doesn't touch the source row.
  // Title suffix " (copy)" so the editor knows which is which.
  const { duplicateFrom } = await searchParams;
  // Phase 9.21  the form's `initial` prop accepts either the flat
  // VacancyFormValue shape OR a nested `seasonalWindow` object (read
  // shape). The duplicate-from-existing path uses the nested object
  // because the source is a VacancyRow.
  let initial:
    | (Partial<VacancyFormValue> & {
        seasonalWindow?: import("@/lib/mock/types").SeasonalWindow | null;
      })
    | undefined;
  let pageSubtitle =
    "Private to your organisation. Vacancies start as drafts  open them when ready to invite candidates.";
  if (duplicateFrom) {
    const source = await getMyVacancy(duplicateFrom);
    if (source) {
      initial = {
        title: `${source.title} (copy)`,
        professionSlug: source.professionSlug,
        provinceSlug: source.provinceSlug,
        citySlug: source.citySlug,
        skillSlugs: source.skillSlugs,
        seniority: source.seniority,
        salaryBand: source.salaryBand,
        description: source.description,
        documentsRequired: source.documentsRequired,
        inviteExpiryDays: source.inviteExpiryDays,
        workAvailability: source.workAvailability,
        minYearsExperience: source.minYearsExperience,
        minNqfLevel: source.minNqfLevel,
        // Phase 9.21  the form widens `initial` to accept either the
        // nested `seasonalWindow` object (this path  source is a
        // VacancyRow) or the three flat fields. Passing the nested
        // object keeps this duplicate-from-existing intact for
        // seasonal vacancies.
        seasonalWindow: source.seasonalWindow,
      };
      pageSubtitle = `Pre-filled from "${source.title}". Edit anything before saving  this creates a fresh draft, the original stays untouched.`;
    }
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
      pageTitle={initial ? "Duplicate vacancy" : "New vacancy"}
      pageSubtitle={pageSubtitle}
    >
      {/* Phase 10.1  in-context help deep-link (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink slug="creating-a-vacancy" label="How to create a vacancy" />
        <HelpLink slug="match-requirements" label="Match requirements explained" />
        <HelpLink slug="vacancy-snapshot-on-invites" label="What seekers see on invites" />
      </div>
      <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-8">
        <VacancyForm
          initial={initial}
          professions={professions}
          provinces={PROVINCES}
          skills={SKILLS}
          // Phase 9.19  scope the sessionStorage draft per source so
          // duplicating two different vacancies doesn't bleed drafts.
          draftId={duplicateFrom ? `duplicate-${duplicateFrom}` : "new"}
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
