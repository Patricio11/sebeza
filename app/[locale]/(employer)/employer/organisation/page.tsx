/**
 * Employer  Organisation summary surface.
 *
 * Phase 9.10 made `/employer/onboarding` the canonical edit + KYC
 * surface. This page is the read-only "trust" summary  it reads
 * live org state via `getMyOrgVettingState()` (the same Phase 9.10
 * query) and renders organisation details + the live verification
 * badge. The "Save" form on this page used to be cosmetic + hard-
 * coded against MOCK_EMPLOYER  removed in the 9.13 audit sweep
 * (no mock data in production paths). Every edit goes through
 * `/employer/onboarding`, which has the proper Server Action +
 * audit trail.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { Button } from "@/components/ui/Button";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { Pencil, ShieldCheck } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";
import { verifyEmployer } from "@/lib/auth/dal";
import { getMyOrgVettingState } from "@/lib/employer/vetting";

export const revalidate = 0;

export default async function OrganisationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();
  const t = await getTranslations("employerDash.organisation");
  const tOuter = await getTranslations("employerDash");

  const state = await getMyOrgVettingState();
  const orgName = state?.orgName ?? session.orgName ?? "Your organisation";
  const verification = state?.verification ?? "unverified";
  const isVerified = verification === "verified";

  return (
    <DashboardMasthead
      role="employer"
      pageEyebrow="Trust"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      banner={
        !isVerified ? (
          <OrgVerificationBanner
            message={tOuter("orgUnverifiedBanner")}
            cta={tOuter("orgUnverifiedCta")}
          />
        ) : null
      }
    >
      {/* Phase 10.1  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink slug="kyc" label="KYC walkthrough" />
        <HelpLink slug="what-we-hold" label="What data we hold" />
      </div>
      <div className="grid gap-10 md:grid-cols-[1fr_320px]">
        {/* ── Read-only summary; edits go via /employer/onboarding ─── */}
        <section>
          <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
            <h2 className="font-display text-2xl">{t("details")}</h2>
            <Link
              href="/employer/onboarding"
              className="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              <Pencil className="size-3" aria-hidden="true" />
              Edit details
            </Link>
          </header>

          <dl className="grid gap-5 md:grid-cols-2">
            <Field label={t("company")} value={orgName} />
            <Field
              label={t("registration")}
              value={state?.registrationNumber}
            />
            <Field label={t("industry")} value={state?.industry} />
            <Field label={t("country")} value={state?.country} />
            <Field label="Head office city" value={state?.city} />
            <Field label="Company address" value={state?.companyAddress} />
            <Field label="VAT number" value={state?.vatNumber} />
          </dl>

          <p className="mt-6 text-xs italic text-[color:var(--color-ink-soft)]">
            All organisation details + verification documents are managed on{" "}
            <Link
              href="/employer/onboarding"
              className="underline hover:text-[color:var(--color-ink)]"
            >
              /employer/onboarding
            </Link>
            . This page is a read-only summary.
          </p>
        </section>

        {/* ── Verification card  reads live `verification` ─── */}
        <aside className="md:pt-12">
          <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              {t("verification")}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <VerificationBadge state={verification} />
            </div>
            <p className="mt-3 text-sm text-[color:var(--color-ink-soft)]">
              {isVerified
                ? "Your organisation is verified. You can reveal candidate contact details and request documents  every access is audit-logged."
                : verification === "pending"
                  ? "Your application is under review by our team. We typically respond within one business day."
                  : verification === "rejected"
                    ? "Your verification application was not approved. Open onboarding to read the reviewer's note and resubmit."
                    : "You haven't submitted for verification yet. Until then, contact reveal and document requests stay locked."}
            </p>
            {!isVerified && (
              <Link
                href="/employer/onboarding"
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                {verification === "rejected"
                  ? "Resubmit application"
                  : verification === "pending"
                    ? "View application status"
                    : t("submitForVerification")}
              </Link>
            )}
            <p className="mt-3 text-xs italic text-[color:var(--color-ink-soft)]">
              {t("kycSlot")}
            </p>
          </div>
        </aside>
      </div>
    </DashboardMasthead>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd
        className={
          "mt-1 text-sm " +
          (value
            ? "text-[color:var(--color-ink)]"
            : "italic text-[color:var(--color-ink-soft)]")
        }
      >
        {value ?? "Not set"}
      </dd>
    </div>
  );
}
