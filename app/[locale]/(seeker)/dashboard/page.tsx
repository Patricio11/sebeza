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
  // Career compass still reads from the mock dataset (Phase 6 wires the real
  // demand-by-skill query). The seeker's handle is the lookup key.
  const compass = getCompassForHandle(me.handle);
  const topRec = compass.recommendations[0];

  // Derive Next steps from real profile state — never lie about what's done.
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
                {me.completeness >= 80
                  ? "Your profile is in excellent shape — recruiters will see it first."
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

        {/* Talent Pulse — live; calls setStatus / reconfirmStatus */}
        <StatusCard
          status={me.status}
          statusConfirmedAt={me.statusConfirmedAt}
          band={freshness.band}
          locale={locale}
          lastConfirmedLabel={lastConfirmed}
        />

        {/* Rank in search — see your live position in the FTS-ranked pool */}
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
            See your live position in the{" "}
            <em>
              {me.profession} · {me.province}
            </em>{" "}
            pool. Search runs Postgres FTS ranked by{" "}
            <span className="text-[color:var(--color-ink)]">
              relevance × freshness × completeness
            </span>
            .
          </p>
          <Link
            href={`/search?query=${encodeURIComponent(me.profession)}&province=${encodeURIComponent(me.province.toLowerCase().replace(/\s+/g, "-"))}`}
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)]"
          >
            See your pool
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
            A "your rank" widget that highlights you in the result list comes
            with the Phase 5 employer reveal flow.
          </p>
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

        {/* Next steps — derived from real profile state */}
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

        {/* Activity — real audit log filtered to this seeker */}
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
