import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { StatusChip } from "@/components/ui/StatusChip";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { dataProvider } from "@/lib/data/provider";
import { freshnessBand } from "@/lib/mock/helpers";
import { formatRelativeTime } from "@/lib/utils";
import { Eye, MessageCircle } from "lucide-react";

// Mock-only Phase 1 dashboard. Phase 2 wires this to a real signed-in seeker.
// For demo, we pin to "lerato-n" — a typical signed-in profile.
const MOCK_HANDLE = "lerato-n";

export default async function SeekerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await dataProvider.getProfile(MOCK_HANDLE);
  const t = await getTranslations("dashboard.seeker");
  if (!me) return null;

  const band = freshnessBand(me.statusConfirmedAt);
  const lastConfirmed = formatRelativeTime(me.statusConfirmedAt, locale);
  const nextActionN = Math.max(0, 5 - me.topSkills.length);

  return (
    <>
      <SiteHeader />
      <main id="main" className="pb-24 md:pb-0">
        {/* Masthead */}
        <header className="border-b-2 border-[color:var(--color-ink)]">
          <div className="mx-auto max-w-[1240px] px-5 py-10 md:px-8 md:py-14">
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              Hello, {me.displayName.split(" ")[0]} — your private dashboard
            </div>
            <h1 className="mt-2 font-display text-3xl md:text-5xl">{t("title")}</h1>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-8 px-5 py-10 md:grid-cols-3 md:px-8">
          {/* Visibility — completeness + next action */}
          <section
            aria-labelledby="vis-h"
            className="md:col-span-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:p-8"
          >
            <header className="mb-4 flex items-baseline justify-between">
              <h2 id="vis-h" className="font-display text-2xl">
                {t("completenessLabel")}
              </h2>
              <VerificationBadge state={me.verification} />
            </header>
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <ProfileCompleteness value={me.completeness} variant="arc" />
              <div className="max-w-md text-[color:var(--color-ink-soft)]">
                <p>
                  {nextActionN > 0
                    ? t("nextAction", { n: nextActionN })
                    : "Your profile is in excellent shape — recruiters will see it first."}
                </p>
              </div>
            </div>
          </section>

          {/* Talent Pulse — the freshness control */}
          <section
            aria-labelledby="pulse-h"
            className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-6 md:p-8"
          >
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
              Talent Pulse
            </div>
            <h2 id="pulse-h" className="mt-1 font-display text-xl">
              {t("pulseQuestion")}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("lastConfirmed", { when: lastConfirmed })} ·{" "}
              <span
                className={
                  band === "fresh"
                    ? "text-[color:var(--color-employed)]"
                    : band === "ageing"
                      ? "text-[color:var(--color-accent)]"
                      : "text-[color:var(--color-stale)]"
                }
              >
                {band}
              </span>
            </p>
            <div className="mt-4">
              <StatusChip
                status={me.status}
                confirmedAt={me.statusConfirmedAt}
                locale={locale}
              />
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] py-3 text-sm font-medium text-[color:var(--color-paper)]"
            >
              {t("confirmFresh")}
            </button>
            <p className="mt-3 text-[0.7rem] leading-snug text-[color:var(--color-ink-soft)]">
              Confirming keeps you ranked. Stale statuses fall down the list —
              honesty is how we beat the old register.
            </p>
          </section>

          {/* Activity panels */}
          <ActivityPanel
            icon={<Eye className="size-4" aria-hidden="true" />}
            title={t("viewedBy")}
            empty={t("noViewers")}
          >
            <ActivityRow when="2 hours ago" who="Verified employer" detail="Wits Health Sciences (Gauteng)" />
            <ActivityRow when="Yesterday" who="Verified employer" detail="Discovery Bank (Western Cape)" />
            <ActivityRow when="3 days ago" who="Verified employer" detail="Yoco (Western Cape)" />
          </ActivityPanel>

          <ActivityPanel
            icon={<MessageCircle className="size-4" aria-hidden="true" />}
            title={t("contactedBy")}
            empty={t("noContacts")}
          >
            <ActivityRow
              when="Yesterday"
              who="Discovery Bank"
              detail='Re: "Senior engineer — Sandton"'
            />
          </ActivityPanel>

          <section
            aria-label="Privacy centre"
            className="md:col-span-3 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-6 md:p-8"
          >
            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
              <div>
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                  Privacy centre
                </div>
                <h2 className="font-display text-xl">
                  Your data is yours. Always.
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
                  View every audit-logged access to your profile, revoke consent
                  for searchability or contact reveal, export your data, or
                  request erasure. Wired up in Phase 2.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-5 py-2 text-sm font-medium opacity-60"
              >
                Open privacy centre
              </button>
            </div>
          </section>
        </div>
      </main>
      <MobileTabBar active="home" />
      <SiteFooter />
    </>
  );
}

function ActivityPanel({
  title,
  empty,
  icon,
  children,
}: {
  title: string;
  empty: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  const hasContent = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
      <header className="mb-3 flex items-center gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <span className="text-[color:var(--color-ink-soft)]">{icon}</span>
        <h2 className="font-display text-lg">{title}</h2>
      </header>
      {hasContent ? (
        <ol className="divide-y divide-[color:var(--color-hairline)]">
          {children}
        </ol>
      ) : (
        <EmptyState title={empty} />
      )}
    </section>
  );
}

function ActivityRow({
  when,
  who,
  detail,
}: {
  when: string;
  who: string;
  detail: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3 py-2.5 text-sm">
      <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {when}
      </span>
      <span>
        <span className="font-medium text-[color:var(--color-ink)]">{who}</span>
        <span className="block text-xs text-[color:var(--color-ink-soft)]">
          {detail}
        </span>
      </span>
    </li>
  );
}
