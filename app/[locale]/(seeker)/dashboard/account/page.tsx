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
import { TwoFactorAccountPanel } from "@/components/feature/auth/TwoFactorAccountPanel";
import { NotificationPrefsPanel } from "@/components/feature/notifications/NotificationPrefsPanel";
import { getMyNotificationPrefs } from "@/lib/notifications/query";
import type { NotificationKind } from "@/lib/notifications/catalog";
import { getSetting } from "@/lib/admin/settings";
import { HelpLink } from "@/components/feature/help/HelpLink";
import { DataSaverPreference } from "@/components/feature/account/DataSaverPreference";
import { PhoneChannelPanel } from "@/components/feature/account/PhoneChannelPanel";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appUser as appUserTable } from "@/db/schema";

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
  const prefs = await getMyNotificationPrefs();
  const emailChannelEnabled = await getSetting<boolean>("feature_flag_email_notifications");

  // Phase 11.4.3 + 11.4.4  account-row reads for the new preference
  // surfaces. dataSaverMode flag drives bandwidth downgrades; the SMS /
  // WhatsApp channel reads gate the phone-channel panel + read the
  // admin platform flags.
  const db = getDb();
  const accountRow = await db
    .select({
      dataSaverMode: appUserTable.dataSaverMode,
      phoneE164Enc: appUserTable.phoneE164Enc,
      phoneVerifiedAt: appUserTable.phoneVerifiedAt,
      smsChannelEnabled: appUserTable.smsChannelEnabled,
      whatsappChannelEnabled: appUserTable.whatsappChannelEnabled,
    })
    .from(appUserTable)
    .where(eq(appUserTable.id, session.id))
    .limit(1);
  const account = accountRow[0] ?? {
    dataSaverMode: false,
    phoneE164Enc: null,
    phoneVerifiedAt: null,
    smsChannelEnabled: false,
    whatsappChannelEnabled: false,
  };
  const smsChannelEnabled = await getSetting<boolean>(
    "feature_flag_sms_channel_enabled",
  );
  const whatsappChannelEnabled = await getSetting<boolean>(
    "feature_flag_whatsapp_channel_enabled",
  );

  const SEEKER_NOTIFICATION_KINDS: NotificationKind[] = [
    "contact.revealed",
    "document.downloaded",
    "placement.confirmed",
    "qualification.verified",
    "qualification.rejected",
    "profile.viewed",
    "status.stale.warning",
    "account.suspended",
    "account.restored",
  ];

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
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="two-factor-authentication-setup" label="Enable 2FA" />
        <HelpLink role="seeker" slug="resetting-your-password" label="Reset your password" />
        <HelpLink role="seeker" slug="managing-notification-preferences" label="Notifications guide" />
      </div>

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
          <TwoFactorAccountPanel
            enabled={Boolean(session.twoFactorEnabled)}
            enforced={false}
          />
          <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
            {t("twoFactorOptionalSeeker")}
          </p>
        </section>

        <section
          aria-labelledby="notif-prefs-h"
          className="md:col-span-2"
        >
          <h2
            id="notif-prefs-h"
            className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl"
          >
            Notification preferences
          </h2>
          <NotificationPrefsPanel
            initialPrefs={prefs}
            kinds={SEEKER_NOTIFICATION_KINDS}
            emailChannelEnabled={emailChannelEnabled}
          />
        </section>

        {/* Phase 11.4.3  data-saver toggle. */}
        <section aria-labelledby="data-saver-h" className="md:col-span-2">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Data + bandwidth
          </h2>
          <DataSaverPreference initial={account.dataSaverMode} />
        </section>

        {/* Phase 11.4.4  phone + SMS/WhatsApp panel. The panel itself
            renders a dormant "Coming soon" state when both admin flags
            are off, and a verification flow when at least one is on.
            Zero spend before the admin flips a flag. */}
        <section aria-labelledby="phone-h" className="md:col-span-2">
          <h2
            id="phone-h"
            className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl"
          >
            SMS &amp; WhatsApp notifications
          </h2>
          <PhoneChannelPanel
            hasPhone={!!account.phoneE164Enc}
            phoneVerifiedAt={account.phoneVerifiedAt?.toISOString() ?? null}
            smsEnabled={account.smsChannelEnabled}
            whatsappEnabled={account.whatsappChannelEnabled}
            platformSmsEnabled={smsChannelEnabled}
            platformWhatsappEnabled={whatsappChannelEnabled}
          />
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
