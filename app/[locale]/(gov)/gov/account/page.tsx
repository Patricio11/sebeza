import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";
import { TwoFactorAccountPanel } from "@/components/feature/auth/TwoFactorAccountPanel";
import { verifyGov } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function GovAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await verifyGov();
  const enforced = await getSetting<boolean>("feature_flag_2fa_enforced");

  return (
    <DashboardMasthead
      role="gov"
      pageEyebrow="Your account"
      pageTitle="Account"
      pageSubtitle="Government / policy workspace session + 2FA. POPIA-grade accounts always use 2FA."
      pageActions={<SignOutButton />}
    >
      {/* Phase 10.4  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="gov" slug="two-factor-authentication" label="2FA setup" />
        <HelpLink role="gov" slug="your-activity-audit-trail" label="Audit trail + POPIA rights" />
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Profile
          </h2>
          <dl className="grid gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm">
            <div>
              <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Name
              </dt>
              <dd className="font-display text-base">{me.name}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Email
              </dt>
              <dd className="font-mono text-xs">{me.email}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Role
              </dt>
              <dd className="font-display text-base">Government / policy</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Two-factor authentication
          </h2>
          <TwoFactorAccountPanel
            enabled={Boolean(me.twoFactorEnabled)}
            enforced={enforced}
          />
        </section>
      </div>
    </DashboardMasthead>
  );
}
