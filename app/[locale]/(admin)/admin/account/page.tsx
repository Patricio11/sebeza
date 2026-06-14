import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";
import { TwoFactorAccountPanel } from "@/components/feature/auth/TwoFactorAccountPanel";
import { NotificationPrefsPanel } from "@/components/feature/notifications/NotificationPrefsPanel";
import { getMyNotificationPrefs } from "@/lib/notifications/query";
import type { NotificationKind } from "@/lib/notifications/catalog";
import { verifyAdmin } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { HelpLink } from "@/components/feature/help/HelpLink";

const ADMIN_NOTIFICATION_KINDS: NotificationKind[] = [
  "moderation.reported",
  "verification.queued",
];

export default async function AdminAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await verifyAdmin();
  const enforced = await getSetting<boolean>("feature_flag_2fa_enforced");
  const emailChannelEnabled = await getSetting<boolean>("feature_flag_email_notifications");
  const prefs = await getMyNotificationPrefs();

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Your account"
      pageTitle="Account"
      pageSubtitle="Your administrator session and notification preferences."
      pageActions={<SignOutButton />}
    >
      {/* Phase 10.3  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="admin" slug="first-login-and-2fa-setup" label="2FA setup" />
        <HelpLink role="admin" slug="team-roles-and-permissions" label="Roles + permissions" />
        <HelpLink role="admin" slug="notification-settings-for-admins" label="Notifications" />
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
              <dd className="font-display text-base">Administrator</dd>
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

        <section className="md:col-span-2">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Notification preferences
          </h2>
          <p className="mb-4 text-sm text-[color:var(--color-ink-soft)]">
            Admin notifications come from public reports and verification
            submissions. They land in your bell and on /admin/notifications.
          </p>
          <NotificationPrefsPanel
            initialPrefs={prefs}
            kinds={ADMIN_NOTIFICATION_KINDS}
            emailChannelEnabled={emailChannelEnabled}
          />
        </section>
      </div>
    </DashboardMasthead>
  );
}
