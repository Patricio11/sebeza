import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { dataProvider } from "@/lib/data/provider";
import { verifyRole } from "@/lib/auth/dal";
import { Smartphone, Monitor, Tablet } from "lucide-react";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";

const MOCK_HANDLE = "andile-z";

interface Device {
  kind: "phone" | "laptop" | "tablet";
  name: string;
  city: string;
  lastSeen: string;
  current?: boolean;
}

const MOCK_DEVICES: Device[] = [
  { kind: "laptop", name: "MacBook Pro · Firefox", city: "Johannesburg", lastSeen: "Now", current: true },
  { kind: "phone", name: "Pixel 7 · Chrome", city: "Johannesburg", lastSeen: "Yesterday" },
  { kind: "tablet", name: "iPad · Safari", city: "Cape Town", lastSeen: "11 days ago" },
];

const DEV_ICON = { phone: Smartphone, laptop: Monitor, tablet: Tablet };

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("seeker");
  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;
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
              defaultValue="lerato.nkosi@example.co.za"
              type="email"
              autoComplete="email"
            />
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
                {t("password")}
              </div>
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                Last changed 3 months ago.
              </p>
              <Button variant="secondary" size="sm" className="mt-3">
                {t("changePassword")}
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
              <Button variant="primary" size="sm">
                Configure
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="sessions-h" className="md:col-span-2">
          <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
            <h2 id="sessions-h" className="font-display text-xl">
              {t("sessions")}
            </h2>
            <Button variant="ghost" size="sm">
              {t("signOutAll")}
            </Button>
          </header>
          <ul className="divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            {MOCK_DEVICES.map((d, i) => {
              const Icon = DEV_ICON[d.kind];
              return (
                <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4">
                  <Icon className="size-5 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-[color:var(--color-ink-soft)]">
                      {d.city} · {d.lastSeen}
                    </div>
                  </div>
                  {d.current ? (
                    <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                      This device
                    </span>
                  ) : (
                    <Button variant="ghost" size="sm">
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </DashboardShell>
  );
}
