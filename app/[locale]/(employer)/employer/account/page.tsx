import { setRequestLocale, getTranslations } from "next-intl/server";
import { eq, and } from "drizzle-orm";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";
import { TwoFactorAccountPanel } from "@/components/feature/auth/TwoFactorAccountPanel";
import { NotificationPrefsPanel } from "@/components/feature/notifications/NotificationPrefsPanel";
import { getMyNotificationPrefs } from "@/lib/notifications/query";
import type { NotificationKind } from "@/lib/notifications/catalog";
import { verifyEmployer, getSessionUser } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export default async function EmployerAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Phase 9.10  switched from verifyRole to verifyEmployer so the
  // dashboard shell gets the live org name from the DB (no static
  // fallback). Also fetch the org-member role for the "Your role at
  // the organisation" field so it reflects DB state.
  const session = await verifyEmployer();
  const me = await getSessionUser();
  const enforced = await getSetting<boolean>("feature_flag_2fa_enforced");
  const prefs = await getMyNotificationPrefs();
  const emailChannelEnabled = await getSetting<boolean>("feature_flag_email_notifications");
  const t = await getTranslations("employerDash.account");
  const tOuter = await getTranslations("employerDash");

  // Live org-member role (owner / recruiter / viewer) for this user.
  const db = getDb();
  const memberRole = session.orgId
    ? (
        await db
          .select({ role: schema.organizationMembers.role })
          .from(schema.organizationMembers)
          .where(
            and(
              eq(schema.organizationMembers.organizationId, session.orgId),
              eq(schema.organizationMembers.userId, session.id),
            ),
          )
          .limit(1)
      )[0]?.role ?? null
    : null;

  const EMPLOYER_NOTIFICATION_KINDS: NotificationKind[] = [
    "org.verified",
    "org.rejected",
    "saved_search.new_matches",
  ];

  return (
    <DashboardMasthead
      role="employer"
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
              defaultValue={me?.name ?? ""}
            />
            <TextField
              id="email"
              label="Email"
              type="email"
              defaultValue={me?.email ?? ""}
            />
            <TextField
              id="role"
              label="Your role at the organisation"
              defaultValue={memberRole ?? ""}
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
            emailChannelEnabled={emailChannelEnabled}
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
    </DashboardMasthead>
  );
}
