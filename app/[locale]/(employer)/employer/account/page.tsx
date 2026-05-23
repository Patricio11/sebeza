import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";
import { TwoFactorAccountPanel } from "@/components/feature/auth/TwoFactorAccountPanel";
import { NotificationPrefsPanel } from "@/components/feature/notifications/NotificationPrefsPanel";
import { getMyNotificationPrefs } from "@/lib/notifications/query";
import type { NotificationKind } from "@/lib/notifications/catalog";
import { verifyRole, getSessionUser } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";

export default async function EmployerAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("employer");
  const me = await getSessionUser();
  const enforced = await getSetting<boolean>("feature_flag_2fa_enforced");
  const prefs = await getMyNotificationPrefs();
  const t = await getTranslations("employerDash.account");
  const tOuter = await getTranslations("employerDash");

  const EMPLOYER_NOTIFICATION_KINDS: NotificationKind[] = [
    "org.verified",
    "org.rejected",
    "saved_search.new_matches",
  ];

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
      pageActions={<SignOutButton />}
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
          <TwoFactorAccountPanel
            enabled={Boolean(me?.twoFactorEnabled)}
            enforced={enforced}
          />
        </section>

        <section className="md:col-span-2">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Notification preferences
          </h2>
          <NotificationPrefsPanel
            initialPrefs={prefs}
            kinds={EMPLOYER_NOTIFICATION_KINDS}
          />
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
