import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { ShieldCheck } from "lucide-react";

export default async function OrganisationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("employerDash.organisation");
  const tOuter = await getTranslations("employerDash");
  const org = MOCK_EMPLOYER;

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={org.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="organisation"
      pageEyebrow="Trust"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      banner={
        <OrgVerificationBanner
          message={tOuter("orgUnverifiedBanner")}
          cta={tOuter("orgUnverifiedCta")}
        />
      }
    >
      <div className="grid gap-10 md:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl">
            {t("details")}
          </h2>
          <form className="grid gap-5 md:grid-cols-2">
            <TextField id="orgName" label={t("company")} defaultValue={org.orgName} />
            <TextField
              id="registration"
              label={t("registration")}
              defaultValue={org.registration}
            />
            <SelectField id="industry" label={t("industry")} defaultValue={org.industry}>
              <option>{org.industry}</option>
              <option>Hospitality</option>
              <option>Construction</option>
              <option>Healthcare</option>
              <option>Information technology</option>
              <option>Manufacturing</option>
              <option>Retail</option>
              <option>Mining</option>
              <option>Public sector</option>
              <option>Other</option>
            </SelectField>
            <SelectField id="size" label={t("size")} defaultValue={org.size}>
              <option>1 – 10</option>
              <option>11 – 50</option>
              <option>51 – 200</option>
              <option>201 – 1 000</option>
              <option>{org.size}</option>
            </SelectField>
            <SelectField id="country" label={t("country")} defaultValue={org.country}>
              <option>{org.country}</option>
              <option>Other (operates in SA)</option>
            </SelectField>
            <TextField id="city" label="Head office city" defaultValue={org.city} />
          </form>

          <div className="mt-6">
            <Button type="submit" variant="ghost" size="md">
              Save organisation details
            </Button>
          </div>
        </section>

        <aside className="md:pt-12">
          <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              {t("verification")}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <VerificationBadge state={org.orgVerified ? "verified" : "pending"} />
            </div>
            <p className="mt-3 text-sm text-[color:var(--color-ink-soft)]">
              {org.orgVerified
                ? "Your organisation is verified. You can reveal candidate contact details and request documents — every access is audit-logged."
                : "You haven't submitted for verification yet. Until then, contact reveal and document requests stay locked."}
            </p>
            {!org.orgVerified && (
              <Button variant="primary" size="md" className="mt-4 w-full">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t("submitForVerification")}
              </Button>
            )}
            <p className="mt-3 text-xs italic text-[color:var(--color-ink-soft)]">
              {t("kycSlot")}
            </p>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
