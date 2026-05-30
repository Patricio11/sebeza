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
import { getSeekerActivity } from "@/lib/profile/activity";
import { rankInPoolQuery } from "@/db/queries/analytics";
import {
  Eye,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Compass,
} from "lucide-react";
import { getCompassForProfile } from "@/db/queries/career-compass";
import { StatusCard } from "@/components/feature/profile/StatusCard";
import { SelfReportPlacementCard } from "@/components/feature/profile/SelfReportPlacementCard";
import { StatusNudgeBanner } from "@/components/feature/profile/StatusNudgeBanner";
import { listMyInvitations } from "@/lib/seeker/invitations";
import { getSetting } from "@/lib/admin/settings";
import { Inbox } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";
import { WelcomeBackCard } from "@/components/feature/seeker/WelcomeBackCard";
import { readAndSetLastSeen } from "@/lib/cookies/welcome-back";
import { RecentAchievementsStrip } from "@/components/feature/seeker/RecentAchievementsStrip";
import { listMyBadges } from "@/lib/seeker/badges";

export default async function SeekerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard");

  // Phase 11.1.3  read-and-set the welcome-back cookie. Returns the
  // absence days when >= 7, null otherwise.
  const absenceDays = await readAndSetLastSeen();

  const t = await getTranslations("seekerDash");
  const verificationVisible = await getSetting<boolean>(
    "feature_flag_verification_badges_visible",
  );
  const lastConfirmed = formatRelativeTime(me.statusConfirmedAt, locale);
  const freshness = freshnessSummary(me.statusConfirmedAt);
  // Phase 6: real compass  recommendations come from live search-event
  // demand intersected with the controlled skill taxonomy, scoped to the
  // seeker's profession + province.
  const compass = await getCompassForProfile(me);
  const topRec = compass.recommendations[0];

  // Derive Next steps from real profile state  never lie about what's done.
  const nextSteps: { text: string; done: boolean; href?: string }[] = [
    {
      text: "Verify your email address",
      done: true, // sign-in only succeeds for verified emails
    },
    {
      text: "Add a profile photo",
      done: !!me.profilePhotoUrl,
      href: "/dashboard/profile#avatar",
    },
    {
      text:
        me.topSkills.length >= 5
          ? "Skills set is strong"
          : `Add ${5 - me.topSkills.length} more skill${
              5 - me.topSkills.length === 1 ? "" : "s"
            }`,
      done: me.topSkills.length >= 5,
      href: "/dashboard/profile#skills",
    },
    {
      text:
        (me.qualifications?.length ?? 0) > 0
          ? "Certificate on file"
          : "Upload a recent certificate",
      done: (me.qualifications?.length ?? 0) > 0,
      href: "/dashboard/qualifications",
    },
    {
      text:
        (me.experience?.length ?? 0) > 0
          ? "Experience captured"
          : "Add a work-experience entry",
      done: (me.experience?.length ?? 0) > 0,
      href: "/dashboard/experience",
    },
    {
      text: me.hasNationalId
        ? "ID on file (encrypted)"
        : "Add your ID number (encrypted on save)",
      done: me.hasNationalId,
      href: "/dashboard/profile#national-id",
    },
  ];

  // Pull the seeker-side activity feed (real events from audit_log).
  // Empty until Phase 5 starts writing reveal / download events.
  const activity = await getSeekerActivity(me, 6);

  // Real rank in the (profession × province) pool  same blend the search
  // SQL uses, projected with a +2-skill completeness boost.
  const rank = await rankInPoolQuery({
    handle: me.handle,
    profession: me.profession,
    province: me.province,
    projectedSkillBoost: 2,
  });

  // Phase 9.9 sweep  count pending vacancy invites so the overview
  // surfaces a callout when the seeker has something waiting. We
  // count "invited" (awaiting response) separately from
  // "reconsidering" (already actioned but still active)  the
  // callout copy distinguishes them.
  const allInvites = await listMyInvitations();
  const pendingInvites = allInvites.filter((i) => i.state === "invited");

  // Phase 11.1.4  recent achievement badges. Cron at
  // /api/cron/seeker-badge-sweep awards them nightly; the strip is
  // hidden silently when the seeker has none.
  const recentBadges = await listMyBadges(me.profileId, 3);

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
      {/* Phase 11.1.3  welcome-back delta card. Renders only when the
          seeker has been absent >= 7 days AND at least one delta number
          is positive. The card is suppressed silently when the absence
          delivered nothing  nothing-changed is its own honest signal
          but doesn't need celebrating. */}
      {absenceDays !== null && (
        <WelcomeBackCard
          absenceDays={absenceDays}
          viewers={activity.kpis.viewersDelta ?? 0}
          contacts={activity.kpis.contactsDelta ?? 0}
          newInvites={pendingInvites.length}
        />
      )}

      <StatusNudgeBanner band={freshness.band} days={freshness.days} />

      {/* Phase 10.2  help deep-links (D6 mirror from employer). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="how-search-ranking-works" label="How ranking works" />
        <HelpLink role="seeker" slug="understanding-profile-completeness" label="Profile completeness" />
        <HelpLink role="seeker" slug="career-compass-recommendations" label="Career compass" />
      </div>

      {/* Phase 11.1.6  audit-log link prominence. Surfaces the "who
          looked at me this week" signal as a top-of-page callout when
          there's something worth noticing  Sebenza gives this data
          away by default, but most seekers never discovered the
          activity ledger. Only renders when viewersDelta > 0 (something
          actually happened this week) to avoid an empty boast. */}
      {(activity.kpis.viewersDelta ?? 0) > 0 && (
        <Link
          href="/dashboard/activity"
          aria-label={`${activity.kpis.viewersDelta} employers viewed your profile this week. Open activity ledger to see who.`}
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 p-3 transition-colors hover:bg-[color:var(--color-accent)]/10 md:p-4"
        >
          <div className="flex items-start gap-3">
            <Eye
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-accent)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-[color:var(--color-ink)]">
                <strong>{activity.kpis.viewersDelta}</strong> employer
                {activity.kpis.viewersDelta === 1 ? "" : "s"} viewed your
                profile this week.
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                Sebenza records every PII-touching action. You can see
                exactly who.
              </p>
            </div>
          </div>
          <span className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] px-3 text-xs font-medium text-[color:var(--color-accent)]">
            See who
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Phase 9.9 sweep  vacancy-invite callout. Only renders when
          there's at least one pending invite. Mobile-first: stacks
          full-width on phones, action button stays thumb-reachable. */}
      {pendingInvites.length > 0 && (
        <Link
          href="/dashboard/invitations"
          aria-label={`You have ${pendingInvites.length} pending vacancy invitation${pendingInvites.length === 1 ? "" : "s"}. Open inbox to respond.`}
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-brand-tint)] p-4 transition-colors hover:bg-[color:var(--color-brand-tint)]/80"
        >
          <div className="flex items-start gap-3">
            <Inbox
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
              aria-hidden="true"
            />
            <div>
              <p className="font-display text-base leading-tight text-[color:var(--color-ink)]">
                {pendingInvites.length === 1
                  ? `1 vacancy invitation waiting for your response`
                  : `${pendingInvites.length} vacancy invitations waiting for your response`}
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                Accept, decline, or decline with a reason. Declining is free.
              </p>
            </div>
          </div>
          <span className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 text-xs font-medium text-[color:var(--color-paper)]">
            Open inbox
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </span>
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Completeness  anchor card */}
        <section
          aria-labelledby="vis-h"
          className="md:col-span-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:p-8"
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 id="vis-h" className="font-display text-2xl">
              {t("overview.completeness")}
            </h2>
            <VerificationBadge state={me.verification} visible={verificationVisible} />
          </header>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <ProfileCompleteness value={me.completeness} variant="arc" />
            <div className="max-w-md text-[color:var(--color-ink-soft)]">
              <p>
                {me.completeness >= 80
                  ? "Your profile is in excellent shape  recruiters will see it first."
                  : me.completeness >= 50
                    ? "Solid foundation. A few more touches put you in the top tier."
                    : "Let's get the essentials in. Each section below adds visible weight."}
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

        {/* Talent Pulse  live; calls setStatus / reconfirmStatus */}
        <StatusCard
          status={me.status}
          statusConfirmedAt={me.statusConfirmedAt}
          band={freshness.band}
          locale={locale}
          lastConfirmedLabel={lastConfirmed}
        />

        {/* Phase 7.5  Self-report a placement when employed. Stored as
            seeker_reported; excluded from official analytics. */}
        {me.status === "employed" && <SelfReportPlacementCard />}

        {/* Rank in search  real position in the (profession × province) pool */}
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
            Your live position in the{" "}
            <em>
              {me.profession} · {me.province}
            </em>{" "}
            pool. Ranked by{" "}
            <span className="text-[color:var(--color-ink)]">
              freshness × completeness × citizen boost
            </span>{" "}
             same blend that drives `/search`.
          </p>
          {rank ? (
            <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4">
              <span className="font-display tabular text-[3.5rem] leading-none text-[color:var(--color-ink)]">
                #{rank.rank}
              </span>
              <div className="border-l border-[color:var(--color-hairline)] pl-4 text-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  of {rank.poolTotal} candidates
                </div>
                <div className="mt-1">
                  {rank.projectedRank < rank.rank ? (
                    <>
                      Adding 2 skills would move you to{" "}
                      <span className="font-display tabular text-base text-[color:var(--color-brand-strong)]">
                        #{rank.projectedRank}
                      </span>
                      .
                    </>
                  ) : rank.rank === 1 ? (
                    "You're top of the pool. Keep your status fresh."
                  ) : (
                    "Your completeness is already maxed in this pool  keep status confirmed."
                  )}
                </div>
              </div>
              <Link
                href={
                  `/search?q=${encodeURIComponent(me.profession)}&province=${encodeURIComponent(me.province.toLowerCase().replace(/\s+/g, "-"))}` as never
                }
                className="text-sm text-[color:var(--color-brand)] hover:underline"
              >
                See the pool →
              </Link>
            </div>
          ) : (
            <div className="text-sm text-[color:var(--color-ink-soft)]">
              Your profile isn't ranked yet  confirm your status to enter
              the pool.
            </div>
          )}
        </section>

        {/* Career compass  strategic glance, drills into /dashboard/grow */}
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
                Your skills are already strong  explore adjacent roles.
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

        {/* Next steps  derived from real profile state */}
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
            {nextSteps.map((step, i) => (
              <NextStep
                key={i}
                text={step.text}
                href={step.href}
                done={step.done}
              />
            ))}
          </ol>
        </section>

        {/* Activity  real audit log filtered to this seeker */}
        <ActivitySection
          icon={<Eye className="size-4" aria-hidden="true" />}
          title={t("overview.viewedBy")}
          empty={t("overview.noViewers")}
          link={{ href: "/dashboard/activity", label: "Open ledger →" }}
        >
          {activity.feed.length > 0
            ? activity.feed.slice(0, 4).map((item, i) => (
                <ActivityRow
                  key={i}
                  when={formatRelativeTime(item.at, locale)}
                  who={item.actor}
                  detail={item.detail}
                />
              ))
            : null}
        </ActivitySection>

        <ActivitySection
          icon={<MessageCircle className="size-4" aria-hidden="true" />}
          title={t("overview.contactedBy")}
          empty={t("overview.noContacts")}
        >
          {activity.feed
            .filter(
              (i) =>
                i.kind === "profile.contact.request" ||
                i.kind === "profile.contact.reveal",
            )
            .slice(0, 3)
            .map((item, i) => (
              <ActivityRow
                key={i}
                when={formatRelativeTime(item.at, locale)}
                who={item.actor}
                detail={item.detail}
              />
            ))}
        </ActivitySection>

        {/* Phase 11.1.4  recent achievement badges. Silent when the
            seeker has none  no badges is honest, not a scolding. */}
        <RecentAchievementsStrip badges={recentBadges} locale={locale} />
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
  link,
}: {
  title: string;
  empty: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  link?: { href: string; label: string };
}) {
  const hasContent = Array.isArray(children)
    ? children.filter(Boolean).length > 0
    : !!children;
  return (
    <section className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
      <header className="mb-3 flex items-center justify-between gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[color:var(--color-ink-soft)]">{icon}</span>
          <h2 className="font-display text-lg">{title}</h2>
        </div>
        {link && hasContent && (
          <Link
            href={link.href as never}
            className="text-xs text-[color:var(--color-brand)] hover:underline"
          >
            {link.label}
          </Link>
        )}
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
      <span className="min-w-0">
        <span className="block truncate font-medium text-[color:var(--color-ink)]">
          {who}
        </span>
        <span className="block text-xs text-[color:var(--color-ink-soft)]">
          {detail}
        </span>
      </span>
    </li>
  );
}
