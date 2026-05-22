import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyProfile } from "@/lib/profile/me";
import { freshnessSummary } from "@/lib/status";
import { formatRelativeTime } from "@/lib/utils";
import {
  Eye,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Compass,
} from "lucide-react";
import { getCompassForHandle } from "@/lib/mock/growth";
import { StatusCard } from "@/components/feature/profile/StatusCard";
import { StatusNudgeBanner } from "@/components/feature/profile/StatusNudgeBanner";

export default async function SeekerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard");

  const t = await getTranslations("seekerDash");
  const lastConfirmed = formatRelativeTime(me.statusConfirmedAt, locale);
  const freshness = freshnessSummary(me.statusConfirmedAt);
  const nextActionN = Math.max(0, 5 - me.topSkills.length);
  // Career compass still reads from the mock dataset (Phase 6 wires the real
  // demand-by-skill query). The seeker's handle is the lookup key.
  const compass = getCompassForHandle(me.handle);
  const topRec = compass.recommendations[0];

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="overview"
      pageEyebrow={t("overview.greeting", { name: me.displayName.split(" ")[0] ?? "" })}
      pageTitle={t("title")}
      pageSubtitle={`${me.profession} · ${me.city}, ${me.province}`}
      pageActions={
        <Link
          href={`/p/${me.handle}`}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
        >
          {t("overview.publicLink")}
        </Link>
      }
    >
      <StatusNudgeBanner band={freshness.band} days={freshness.days} />
      <div className="grid gap-6 md:grid-cols-3">
        {/* Completeness — anchor card */}
        <section
          aria-labelledby="vis-h"
          className="md:col-span-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:p-8"
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 id="vis-h" className="font-display text-2xl">
              {t("overview.completeness")}
            </h2>
            <VerificationBadge state={me.verification} />
          </header>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <ProfileCompleteness value={me.completeness} variant="arc" />
            <div className="max-w-md text-[color:var(--color-ink-soft)]">
              <p>
                {nextActionN > 0
                  ? t("overview.nextAction", { n: nextActionN })
                  : "Your profile is in excellent shape — recruiters will see it first."}
              </p>
              <Link
                href="/dashboard/profile"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-brand)] hover:underline"
              >
                Open profile editor
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Talent Pulse — live; calls setStatus / reconfirmStatus */}
        <StatusCard
          status={me.status}
          statusConfirmedAt={me.statusConfirmedAt}
          band={freshness.band}
          locale={locale}
          lastConfirmedLabel={lastConfirmed}
        />

        {/* Rank in search */}
        <section
          aria-labelledby="rank-h"
          className="md:col-span-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:p-8"
        >
          <header className="mb-3 flex items-center gap-2">
            <TrendingUp
              className="size-4 text-[color:var(--color-brand)]"
              aria-hidden="true"
            />
            <h2 id="rank-h" className="font-display text-lg">
              {t("overview.rankInSearch")}
            </h2>
          </header>
          <p className="mb-5 text-sm text-[color:var(--color-ink-soft)]">
            Position in the <em>{me.profession} · {me.province}</em> pool.
          </p>
          <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4">
            <span className="font-display text-[3.5rem] leading-none tabular text-[color:var(--color-ink)]">
              #4
            </span>
            <div className="border-l border-[color:var(--color-hairline)] pl-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                of 312 candidates
              </div>
              <div className="mt-1 text-sm">
                Up 3 places this week. Adding two more skills would move you into
                the top three.
              </div>
            </div>
            <Link
              href="/search"
              className="text-sm text-[color:var(--color-brand)] hover:underline"
            >
              See the pool →
            </Link>
          </div>
        </section>

        {/* Career compass — strategic glance, drills into /dashboard/grow */}
        <section
          aria-labelledby="compass-h"
          className="md:col-span-3 grid grid-cols-1 gap-0 overflow-hidden rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] md:grid-cols-[auto_1fr_auto]"
        >
          <div className="flex items-center gap-3 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-ink)] p-6 text-[color:var(--color-paper)] md:border-b-0 md:border-r">
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-ink)]"
            >
              <Compass className="size-6" />
            </span>
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
                Career compass
              </div>
              <div className="font-display text-lg leading-tight">
                What to learn next
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Highest-leverage skill in your pool
            </div>
            {topRec ? (
              <>
                <h2
                  id="compass-h"
                  className="mt-1 font-display text-2xl text-[color:var(--color-ink)]"
                >
                  {topRec.skill.label}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-[color:var(--color-ink-soft)]">
                  {topRec.detail}
                </p>
              </>
            ) : (
              <h2 id="compass-h" className="mt-1 font-display text-2xl">
                Your skills are already strong — explore adjacent roles.
              </h2>
            )}
          </div>

          <div className="flex flex-col items-stretch justify-center gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-6 md:border-l md:border-t-0">
            <div className="text-center">
              <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Add {compass.headline.skillsNeeded} →
              </div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-display tabular text-base text-[color:var(--color-ink-soft)] line-through">
                  #{compass.headline.currentRank}
                </span>
                <ArrowUpRight className="size-4 text-[color:var(--color-brand)]" aria-hidden="true" />
                <span className="font-display tabular text-3xl text-[color:var(--color-brand-strong)]">
                  #{compass.headline.projectedRank}
                </span>
              </div>
              <div className="mt-0.5 text-[0.62rem] text-[color:var(--color-ink-soft)]">
                in your local pool
              </div>
            </div>
            <Link
              href="/dashboard/grow"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)]"
            >
              Open Career compass
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Next steps */}
        <section
          aria-labelledby="next-h"
          className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-6"
        >
          <header className="mb-3 flex items-center gap-2">
            <Sparkles
              className="size-4 text-[color:var(--color-accent)]"
              aria-hidden="true"
            />
            <h2 id="next-h" className="font-display text-lg">
              {t("overview.nextSteps")}
            </h2>
          </header>
          <ol className="space-y-3 text-sm">
            <NextStep
              done
              text="Verify your email address"
            />
            <NextStep
              done
              text="Grant searchability consent"
            />
            <NextStep
              text="Add two more skills"
              href="/dashboard/profile"
            />
            <NextStep
              text="Upload a recent certificate"
              href="/dashboard/qualifications"
            />
          </ol>
        </section>

        {/* Activity rails */}
        <ActivitySection
          icon={<Eye className="size-4" aria-hidden="true" />}
          title={t("overview.viewedBy")}
          empty={t("overview.noViewers")}
        >
          <ActivityRow when="2 hours ago" who="Verified employer" detail="Wits Health Sciences · Gauteng" />
          <ActivityRow when="Yesterday" who="Verified employer" detail="Discovery Bank · Western Cape" />
          <ActivityRow when="3 days ago" who="Verified employer" detail="Yoco · Western Cape" />
        </ActivitySection>

        <ActivitySection
          icon={<MessageCircle className="size-4" aria-hidden="true" />}
          title={t("overview.contactedBy")}
          empty={t("overview.noContacts")}
        >
          <ActivityRow
            when="Yesterday"
            who="Discovery Bank"
            detail='Re: "Senior engineer — Sandton"'
          />
        </ActivitySection>
      </div>
    </DashboardShell>
  );
}

function NextStep({
  text,
  href,
  done,
}: {
  text: string;
  href?: string;
  done?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={
          "mt-0.5 inline-flex size-5 items-center justify-center rounded-full text-xs " +
          (done
            ? "bg-[color:var(--color-brand)] text-white"
            : "border border-[color:var(--color-ink)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)]")
        }
        aria-hidden="true"
      >
        {done ? <CheckCircle2 className="size-3.5" /> : "·"}
      </span>
      {done ? (
        <span className="text-[color:var(--color-ink-soft)] line-through">
          {text}
        </span>
      ) : href ? (
        <Link
          href={href}
          className="text-[color:var(--color-ink)] hover:underline"
        >
          {text}
        </Link>
      ) : (
        <span>{text}</span>
      )}
    </li>
  );
}

function ActivitySection({
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
