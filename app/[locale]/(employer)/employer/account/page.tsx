import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, LogOut } from "lucide-react";

export default async function EmployerAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("employerDash.account");
  const tOuter = await getTranslations("employerDash");

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="account"
      pageEyebrow="Your account"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="ghost" size="md">
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </Button>
      }
      banner={
        <OrgVerificationBanner
          message={tOuter("orgUnverifiedBanner")}
          cta={tOuter("orgUnverifiedCta")}
        />
      }
    >
      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Personal details
          </h2>
          <div className="space-y-5">
            <TextField
              id="fullName"
              label="Full name"
              defaultValue={MOCK_EMPLOYER.user.fullName}
            />
            <TextField
              id="email"
              label="Email"
              type="email"
              defaultValue={MOCK_EMPLOYER.user.email}
            />
            <TextField
              id="role"
              label="Your role at the organisation"
              defaultValue={MOCK_EMPLOYER.user.role}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            {t("twoFactor")}
          </h2>
          <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5">
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {t("twoFactorRequired")}
            </div>
            <div className="mt-1 font-display text-2xl">{t("active")}</div>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              TOTP via authenticator app. Last used 12 minutes ago.
            </p>
            <Button variant="secondary" size="sm" className="mt-4">
              {t("configure")}
            </Button>
          </div>
        </section>

        <section className="md:col-span-2">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Active sessions
          </h2>
          <ul className="divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            <li className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4">
              <div>
                <div className="font-medium">MacBook Pro · Firefox</div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">
                  Sandton · now
                </div>
              </div>
              <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                This device
              </span>
            </li>
            <li className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4">
              <div>
                <div className="font-medium">iPhone · Sebenza app</div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">
                  Sandton · 2 hours ago
                </div>
              </div>
              <Button variant="ghost" size="sm">Sign out</Button>
            </li>
          </ul>
        </section>
      </div>
    </DashboardShell>
  );
}
