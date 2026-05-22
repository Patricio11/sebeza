import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { getMyProfile } from "@/lib/profile/me";
import { verifyRole } from "@/lib/auth/dal";
import { ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/account");
  const t = await getTranslations("seekerDash.account");

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="account"
      pageEyebrow="Account"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={<SignOutButton label={t("signOut")} />}
    >
      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="email-h">
          <h2
            id="email-h"
            className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl"
          >
            {t("email")} & {t("password")}
          </h2>
          <div className="space-y-5">
            <TextField
              id="email"
              label={t("email")}
              value={session.email}
              type="email"
              autoComplete="email"
              readOnly
              disabled
              hint="Email is locked once verified. Contact support to change."
            />
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
                {t("password")}
              </div>
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                Use{" "}
                <Link
                  href="/forgot-password"
                  className="text-[color:var(--color-brand)] underline"
                >
                  Forgot password
                </Link>{" "}
                to reset via email. In-app password change wires up in Phase 7
                alongside 2FA.
              </p>
              <Button variant="secondary" size="sm" className="mt-3" disabled>
                {t("changePassword")} <span className="ml-2 text-[0.62rem] uppercase tracking-[0.18em]">Phase 7</span>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="2fa-h">
          <h2
            id="2fa-h"
            className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl"
          >
            {t("twoFactor")}
          </h2>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  TOTP
                </div>
                <div className="font-display text-lg">Not configured</div>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {t("twoFactorOptionalSeeker")}
                </p>
              </div>
              <Button variant="primary" size="sm" disabled>
                Configure <span className="ml-2 text-[0.62rem] uppercase tracking-[0.18em]">Phase 7</span>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="sessions-h" className="md:col-span-2">
          <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
            <h2 id="sessions-h" className="font-display text-xl">
              {t("sessions")}
            </h2>
            <Button variant="ghost" size="sm" disabled>
              {t("signOutAll")} <span className="ml-2 text-[0.62rem] uppercase tracking-[0.18em]">Phase 7</span>
            </Button>
          </header>
          <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm text-[color:var(--color-ink)]">
                  Your current session is active. Multi-device session
                  management wires up in Phase 7 alongside 2FA.
                </p>
                <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
                  In the meantime, you can sign out of this device using the
                  button above, or via the sign-out control in the sidebar.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
