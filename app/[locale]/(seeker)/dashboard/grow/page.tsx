import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { Button } from "@/components/ui/Button";
import { getMyProfile } from "@/lib/profile/me";
import { getCompassForProfile } from "@/db/queries/career-compass";
import { rankInPoolQuery } from "@/db/queries/analytics";
import { SKILLS } from "@/lib/mock/taxonomy";
import {
  listMyLearningItems,
  listRecentAbandonReasonsBySkill,
} from "@/lib/seeker/learning";
import { COST_ACCESS_ABANDON_REASONS } from "@/lib/seeker/learning-types";
import { MyLearningSection } from "@/components/feature/seeker/learning/MyLearningSection";
import type { GrowthMomentum } from "@/components/feature/seeker/learning/GrowthMomentumCard";
import { getSetting } from "@/lib/admin/settings";
import { AcceptRecommendationButton } from "@/components/feature/seeker/learning/AcceptRecommendationButton";
import { OpenLearningPathButton } from "@/components/feature/seeker/learning/OpenLearningPathButton";
import { AdjacentProfessionSwitch } from "@/components/feature/seeker/learning/AdjacentProfessionSwitch";
import { StudentLaneDiscoveryCallout } from "@/components/feature/seeker/learning/StudentLaneDiscoveryCallout";
import { RecommendedEmployersCard } from "@/components/feature/seeker/RecommendedEmployersCard";
import { GetWorkReadyCard } from "@/components/feature/seeker/GetWorkReadyCard";
import { topEmployersByProfessionProvince } from "@/db/queries/employer-leaderboard";
import { listMyFollows } from "@/lib/seeker/follows";
import { LazySection } from "@/components/ui/LazySection";
import {
  demandVsCurriculumQuery,
  moduleSkillsForStudent,
} from "@/db/queries/curriculum";
import { loadStudentProgressionTimeline } from "@/db/queries/student-progression";
import { ProgrammeVsMarketCard } from "@/components/feature/analytics/ProgrammeVsMarketCard";
import { StudentProgressionTimeline } from "@/components/feature/analytics/StudentProgressionTimeline";
import {
  PROVIDER_LABEL,
  COST_LABEL,
  type GrowthReason,
  type LearningCost,
  type LearningProviderKind,
  type SkillRecommendation,
  type LearningPath,
  type AdjacentProfession,
} from "@/lib/mock/growth";
import {
  getStudentSnapshot,
  PROGRAMME_KIND_LABEL,
  SECTOR_LABEL,
  APPLICATION_STATUS_LABEL,
  monthsUntil,
  type OpportunityProgramme,
  type ProgrammeElective,
  type GraduateDestination,
} from "@/lib/mock/academic";
import {
  Compass,
  TrendingUp,
  ArrowUpRight,
  GraduationCap,
  Globe2,
  Sparkles,
  Briefcase,
  MapPin,
  Building2,
  Landmark,
  Target,
} from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function CareerCompassPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ missing?: string }>;
}) {
  const { locale } = await params;
  const { missing: missingParam } = await searchParams;
  setRequestLocale(locale);

  // Phase 9.11 ─ deep-link awareness. The vacancy-outcome notification
  // for not-selected candidates lands here with `?missing=slug,slug`.
  // We render a small banner that names the role's missing skills, and
  // recommendation rows whose skill matches one of the slugs get a
  // "Vacancy gap" highlight so the seeker's eye lands on the actionable
  // ones first.
  const missingSlugs = (missingParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  const missingSet = new Set(missingSlugs);
  const missingLabels = missingSlugs.map(
    (slug) => SKILLS.find((s) => s.slug === slug)?.label ?? slug,
  );

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/grow");

  const t = await getTranslations("seekerDash.grow");
  const tStudent = await getTranslations("seekerDash.grow.student");
  // Phase 6: compass reads real demand from `search_events` × the
  // controlled skill taxonomy, weighted by freshness, scoped to the
  // seeker's province. Student snapshot still uses the curated mock
  // catalog of programmes (real SETA / SAQA partnership lands in Phase 8).
  //
  // Phase 6.5: real rank in (profession × province) pool replaces the
  // hardcoded `currentRank: 0` the mock compass returned. We splice the
  // live numbers into the compass headline so the existing UI
  // re-renders without a template change.
  // Phase 9.13  curriculum-vs-market card for student-lane viewers only.
  // We resolve the query input from `me.academic` (set when the seeker
  // captured an academic profile at signup or in the editor). For
  // non-students this stays null + the card isn't rendered.
  const curriculumPromise = me.academic
    ? demandVsCurriculumQuery({
        institutionSlug: me.academic.institutionSlug,
        programme: me.academic.programme,
      })
    : Promise.resolve(null);
  // Phase 13.2  module-level editorial-catalogue inferences. Runs
  // only for students who have declared current_modules / elective /
  // project_topic. Returns the canonical empty shape otherwise so
  // the card just skips its new section silently.
  const studentSkillsPromise = me.academic
    ? moduleSkillsForStudent(me.profileId)
    : Promise.resolve(null);
  // Phase 13.4  progression timeline composed from academic_profiles,
  // qualifications, employer-confirmed placements, completed learning
  // items, and self-declared milestones. Students only.
  const progressionPromise = me.academic
    ? loadStudentProgressionTimeline(me.profileId)
    : Promise.resolve(null);

  const [
    rawCompass,
    rank,
    myLearning,
    recentAbandons,
    curriculum,
    studentSkills,
    progression,
  ] = await Promise.all([
      getCompassForProfile(me),
      rankInPoolQuery({
        handle: me.handle,
        profession: me.profession,
        province: me.province,
        projectedSkillBoost: 2,
      }),
      listMyLearningItems(),
      listRecentAbandonReasonsBySkill(),
      curriculumPromise,
      studentSkillsPromise,
      progressionPromise,
    ]);
  // Phase 9.12  D3 + Accept-button awareness. The compass needs to know:
  //  - which recommendations are already on the seeker's active learning
  //    list (so the Accept button renders as a quiet "On your list" pill)
  //  - which were recently abandoned for cost/access reasons (so D3 can
  //    surface a free alternative; for now we just tag the chip).
  const activeLearningSkills = new Set(
    myLearning
      .filter(
        (i) =>
          i.state === "interested" ||
          i.state === "accepted" ||
          i.state === "in_progress",
      )
      .map((i) => i.skillSlug),
  );
  const costAccessAbandonedSkills = new Set(
    Array.from(recentAbandons.entries())
      .filter(([, reason]) => COST_ACCESS_ABANDON_REASONS.has(reason))
      .map(([slug]) => slug),
  );
  const compass = rank
    ? {
        ...rawCompass,
        headline: {
          ...rawCompass.headline,
          currentRank: rank.rank,
          projectedRank: rank.projectedRank,
          poolLabel: rank.poolLabel,
        },
      }
    : rawCompass;
  const student = me.academic ? getStudentSnapshot(me.academic) : null;
  const nfmt = new Intl.NumberFormat(locale);

  // Phase 17 ("The Climb") — flag-gated learning progress + visible rank
  // payoff. Off = today's learning loop. When on, compute the growth momentum
  // (skills grown, in flight, current → projected rank) + a single-skill
  // projection for the per-row completion modal.
  const skillJourney = await getSetting<boolean>(
    "feature_flag_seeker_skill_journey",
  );
  let momentum: GrowthMomentum | null = null;
  let oneSkillRank: number | null = null;
  if (skillJourney) {
    const activeCount = myLearning.filter(
      (i) => i.state === "accepted" || i.state === "in_progress",
    ).length;
    const grownCount = myLearning.filter((i) => i.state === "completed").length;
    const climb =
      rank && activeCount > 0
        ? await rankInPoolQuery({
            handle: me.handle,
            profession: me.profession,
            province: me.province,
            projectedSkillBoost: activeCount,
          })
        : null;
    oneSkillRank = rank
      ? (
          await rankInPoolQuery({
            handle: me.handle,
            profession: me.profession,
            province: me.province,
            projectedSkillBoost: 1,
          })
        )?.projectedRank ?? rank.rank
      : null;
    momentum = {
      skillsGrown: grownCount,
      inProgress: activeCount,
      currentRank: rank?.rank ?? null,
      poolTotal: rank?.poolTotal ?? null,
      projectedRank: climb?.projectedRank ?? rank?.rank ?? null,
      poolLabel: rank?.poolLabel ?? null,
    };
  }

  return (
    <DashboardMasthead
      role="seeker"
      pageEyebrow={t("eyebrow")}
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="career-compass-recommendations" label="How recommendations work" />
        <HelpLink role="seeker" slug="learning-paths-and-proficiency" label="Learning paths" />
        <HelpLink role="seeker" slug="finding-the-right-course" label="Finding the right course" />
        <HelpLink role="seeker" slug="cost-and-free-alternatives" label="Free alternatives" />
        <HelpLink role="seeker" slug="upgrading-to-verified" label="Upgrading to verified" />
        <HelpLink role="seeker" slug="adjacent-roles-and-skill-gaps" label="Adjacent roles" />
        <HelpLink role="seeker" slug="switching-profession" label="Switching profession" />
        <HelpLink role="seeker" slug="discovering-employers" label="Recommended employers" />
        <HelpLink role="seeker" slug="following-employers" label="Following employers" />
        {/* Phase 13.7  student-only HelpLink. The article itself
            is audience-gated in the help center; this chip only
            surfaces for viewers who'd actually land on the
            progression timeline section below. */}
        {me.academic && (
          <HelpLink role="seeker" slug="student-progression-tracker" label="Progression timeline" />
        )}
      </div>

      {/* ───────────── Vacancy-outcome deep-link banner (Phase 9.11) ─────────────
          Lands here when a seeker opens the in-app / email notification
          about a vacancy that was filled with another candidate. The
          banner restates the role's published gaps (never names or
          attributes the hired person  D4 privacy invariant) and the
          highlighted recommendations below give an actionable next step. */}
      {missingLabels.length > 0 && (
        <section
          aria-label="Vacancy outcome  growth focus"
          className="mb-6 rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-5 md:p-6"
        >
          <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            <Target className="size-3.5" aria-hidden="true" />
            From your recent vacancy outcome
          </div>
          <h2 className="mt-2 font-display text-xl text-[color:var(--color-ink)] md:text-2xl">
            The role asked for{" "}
            <span className="italic">{missingLabels.join(", ")}</span>.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
            We&rsquo;ve highlighted these below in your recommendations and
            learning paths. Closing one or two of them measurably moves
            your rank in this pool.
          </p>
        </section>
      )}

      {/* ───────────── Headline anchor ───────────── */}
      <section
        aria-labelledby="anchor-h"
        className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-6 md:p-10"
      >
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10">
          <div
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-ink)]"
          >
            <Compass className="size-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              {t("eyebrow")}
            </div>
            <h2
              id="anchor-h"
              className="mt-2 font-display text-3xl leading-tight md:text-5xl"
            >
              {t.rich("headline", {
                n: compass.headline.skillsNeeded,
                from: compass.headline.currentRank,
                to: compass.headline.projectedRank,
              })}
            </h2>
            <p className="mt-2 text-[color:var(--color-ink-soft)]">
              {t("headlineSub", { pool: compass.headline.poolLabel })}
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
              >
                {t("openProfileEditor")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Student lane (only when academic record exists) ───────────── */}
      {student && me.academic && (
        <StudentLane
          academic={me.academic}
          snapshot={student}
          locale={locale}
          nfmt={nfmt}
          t={tStudent}
        />
      )}

      {/* ───────────── Phase 9.13  Curriculum vs market (student-side) ───────────── */}
      {me.academic && curriculum && (
        <section className="mt-10">
          <ProgrammeVsMarketCard
            data={curriculum}
            locale={locale}
            moduleSkills={studentSkills ?? undefined}
          />
        </section>
      )}

      {/* ───────────── Phase 13.4  Progression timeline (student-side) ───────────── */}
      {me.academic && progression && (
        <StudentProgressionTimeline
          timeline={progression}
          locale={locale}
          allowEdit={true}
        />
      )}

      {/* Phase 11.2.9  compact student-lane nudge on /dashboard/grow
          itself. The non-student rendering of this page is otherwise
          silent about the academic surface  one quiet line surfaces
          the lane without dominating the page. */}
      {!me.academic && (
        <p className="mt-6">
          <StudentLaneDiscoveryCallout hasAcademic={false} variant="compact" />
        </p>
      )}

      {/* Phase 11.4.5  recommended employers card. Confirmed-hire
          ranking with k=10 suppression. Silent when no orgs clear
          the floor; otherwise lists the top 10 with one-tap Follow. */}
      <RecommendedEmployersSection
        profession={me.profession}
        province={me.province}
      />

      {/* ───────────── My Learning (Phase 9.12 + 11.2.4/.5) ───────────── */}
      <MyLearningSection
        items={myLearning}
        locale={locale}
        skillJourney={skillJourney}
        momentum={momentum}
        poolLabel={rank?.poolLabel ?? null}
        currentRank={rank?.rank ?? null}
        projectedRank={oneSkillRank}
      />

      {/* Phase 15.3.2/.3  Get work-ready (compact), beside the learning
          loop. Student lane gets the first-day + still-learning guides;
          everyone gets a one-tap CV. */}
      <div className="mt-8">
        <GetWorkReadyCard
          variant="compact"
          context={{
            hasPendingInvites: false,
            isStudent: !!me.academic,
            skillCount: me.topSkills.length,
          }}
        />
      </div>

      {/* ───────────── Recommendations ───────────── */}
      <section aria-labelledby="rec-h" className="mt-12">
        <header className="mb-5 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
          <h2 id="rec-h" className="font-display text-2xl">
            {t("recommendationsTitle")}
          </h2>
          <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
            Ranked by gap size
          </span>
        </header>
        <p className="mb-6 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          {t("recommendationsSub")}
        </p>
        <ol className="grid gap-4">
          {compass.recommendations.map((rec, i) => (
            <RecommendationItem
              key={rec.skill.slug}
              rec={rec}
              ordinal={i + 1}
              nfmt={nfmt}
              t={t}
              highlight={missingSet.has(rec.skill.slug)}
              alreadyOnLearningList={activeLearningSkills.has(rec.skill.slug)}
              costAccessAbandoned={costAccessAbandonedSkills.has(rec.skill.slug)}
            />
          ))}
        </ol>
      </section>

      {/* ───────────── Learning paths ───────────── */}
      <section aria-labelledby="paths-h" className="mt-16">
        <header className="mb-5 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
          <h2 id="paths-h" className="font-display text-2xl">
            {t("pathsTitle")}
          </h2>
          <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
            Free first
          </span>
        </header>
        <p className="mb-6 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          {t("pathsSub")}
        </p>
        <ul className="grid gap-4 md:grid-cols-2">
          {compass.learningPaths.map((path, i) => (
            <LearningPathCard key={i} path={path} t={t} />
          ))}
        </ul>
      </section>

      {/* ───────────── Adjacent professions ───────────── */}
      <section aria-labelledby="adj-h" className="mt-16">
        <header className="mb-5 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
          <h2 id="adj-h" className="font-display text-2xl">
            {t("adjacentTitle")}
          </h2>
          <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
            One or two skills away
          </span>
        </header>
        <p className="mb-6 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          {t("adjacentSub")}
        </p>
        <ul className="grid gap-4 md:grid-cols-3">
          {compass.adjacentProfessions.map((adj, i) => (
            <AdjacentProfessionCard
              key={i}
              adj={adj}
              t={t}
              currentProfession={me.profession}
            />
          ))}
        </ul>
      </section>

      {/* Phase 11.5.5  city-demand + downstream sections lazy-load
          when the seeker scrolls within 600px. Above-fold rendering
          stays untouched. */}
      <LazySection placeholderClassName="min-h-[400px]" rootMargin="600px">

      {/* ───────────── City demand ───────────── */}
      <section aria-labelledby="city-h" className="mt-16">
        <header className="mb-5 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
          <h2 id="city-h" className="font-display text-2xl">
            {t("cityDemandTitle")}
          </h2>
          <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
            {me.province}
          </span>
        </header>
        <p className="mb-4 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          {t("cityDemandSub")}
        </p>
        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                <th className="px-5 py-3 font-normal">{t("cityDemandColSkill")}</th>
                <th className="px-5 py-3 font-normal tabular text-right">
                  {t("cityDemandColSearches")}
                </th>
                <th className="px-5 py-3 font-normal tabular text-right">
                  {t("cityDemandColMatches")}
                </th>
                <th className="px-5 py-3 font-normal">{t("cityDemandColGap")}</th>
              </tr>
            </thead>
            <tbody>
              {compass.cityDemand.map((row, i) => {
                const ratio = row.gap / Math.max(row.searches, 1);
                const href = cityDemandSearchHref(row.skill, me.province);
                return (
                  <tr
                    key={i}
                    className="border-t border-[color:var(--color-hairline)] transition-colors hover:bg-[color:var(--color-surface-sunk)]"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={href as never}
                        className="text-[color:var(--color-ink)] hover:underline"
                      >
                        {row.skill}
                      </Link>
                    </td>
                    <td className="px-5 py-3 tabular text-right">
                      {nfmt.format(row.searches)}
                    </td>
                    <td className="px-5 py-3 tabular text-right text-[color:var(--color-ink-soft)]">
                      {nfmt.format(row.matches)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {/* Phase 11.5.6 + .11  hide the bar at very
                            small viewports (≤ 480px) where it adds
                            visual noise; add a visually-hidden span
                            describing the gap ratio for screen
                            readers (the bar itself is aria-hidden). */}
                        <div
                          className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)] sm:block"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full bg-[color:var(--color-accent)]"
                            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                          />
                        </div>
                        <span className="sr-only">
                          {Math.round(ratio * 100)}% gap
                        </span>
                        <span className="font-display tabular text-base text-[color:var(--color-ink)]">
                          {nfmt.format(row.gap)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="space-y-3 md:hidden">
          {compass.cityDemand.map((row, i) => {
            const ratio = row.gap / Math.max(row.searches, 1);
            const href = cityDemandSearchHref(row.skill, me.province);
            return (
              <li
                key={i}
                className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
              >
                <Link
                  href={href as never}
                  className="block text-[color:var(--color-ink)]"
                >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{row.skill}</span>
                  <span className="font-display tabular text-2xl text-[color:var(--color-ink)]">
                    {nfmt.format(row.gap)}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      {t("cityDemandColSearches")}
                    </dt>
                    <dd className="tabular text-sm">{nfmt.format(row.searches)}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      {t("cityDemandColMatches")}
                    </dt>
                    <dd className="tabular text-sm text-[color:var(--color-ink-soft)]">
                      {nfmt.format(row.matches)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-[color:var(--color-accent)]"
                      style={{
                        width: `${Math.min(100, Math.round(ratio * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                    {t("cityDemandColGap")}
                  </span>
                </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ───────────── Honesty note ───────────── */}
      <aside
        aria-label={t("honestNote")}
        className="mt-12 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-6"
      >
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink)]">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("honestNote")}
        </div>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--color-ink-soft)]">
          {t("honestBody")}
        </p>
      </aside>
      </LazySection>
    </DashboardMasthead>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Phase 11.4.5  recommended-employers section wrapper.
 *
 * Loads the leaderboard + the seeker's current follow set so the
 * card can render each row with its correct initial Follow state.
 * Renders nothing when no orgs clear the k=10 suppression floor.
 */
async function RecommendedEmployersSection({
  profession,
  province,
}: {
  profession: string;
  province: string;
}) {
  const rows = await topEmployersByProfessionProvince({
    profession,
    province,
    limit: 10,
  });
  if (rows.length === 0) return null;
  const follows = await listMyFollows();
  const followed = new Set(follows.map((f) => f.orgId));
  return (
    <RecommendedEmployersCard
      rows={rows}
      profession={profession}
      province={province}
      followed={followed}
    />
  );
}

/**
 * Phase 11.2.6  city-demand row -> /search drill-down.
 *
 * The city-demand table holds free-text skill labels (e.g. "Data
 * engineering") and the seeker's province as a display string (e.g.
 * "Gauteng"). The /search page expects a query string + a kebab-case
 * province slug. We slugify in place; D5 keeps the link pointing at the
 * public search surface (the seeker runs the search the way any visitor
 * would, no new auth surface).
 */
function cityDemandSearchHref(skillLabel: string, province: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  return `/search?q=${encodeURIComponent(skillLabel)}&province=${encodeURIComponent(
    slug(province),
  )}`;
}

function RecommendationItem({
  rec,
  ordinal,
  nfmt,
  t,
  highlight,
  alreadyOnLearningList,
  costAccessAbandoned,
}: {
  rec: SkillRecommendation;
  ordinal: number;
  nfmt: Intl.NumberFormat;
  t: (k: string, v?: Record<string, string | number>) => string;
  highlight?: boolean;
  alreadyOnLearningList?: boolean;
  costAccessAbandoned?: boolean;
}) {
  return (
    <li
      className={
        "rounded-[var(--radius-md)] border bg-[color:var(--color-surface)] p-6 " +
        (highlight
          ? "border-2 border-[color:var(--color-accent)] ring-1 ring-[color:var(--color-accent)]"
          : "border-[color:var(--color-hairline)]")
      }
    >
      <div className="grid gap-4 md:grid-cols-[2.5rem_1fr_auto] md:items-start">
        {/* Phase 11.5.10  visually styled "01 / 02 / ..." ordinal.
            Without an explicit aria-label screen readers announce
            "zero one"  confusing. The aria-label restates it as
            "Recommendation 1". The styled glyph stays visual via
            aria-hidden on the inner span. */}
        <span
          className="font-display text-[1.75rem] italic leading-none text-[color:var(--color-accent)]"
          aria-label={`Recommendation ${ordinal}`}
          role="text"
        >
          <span aria-hidden="true">
            {ordinal.toString().padStart(2, "0")}
          </span>
        </span>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl text-[color:var(--color-ink)]">
              {rec.skill.label}
            </h3>
            <ReasonChip reason={rec.reason} t={t} />
            {highlight && (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
                <Target className="size-3" aria-hidden="true" />
                Vacancy gap
              </span>
            )}
            {costAccessAbandoned && (
              <span
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]"
                title="You previously gave up on this skill for cost or access reasons  free alternative shown."
              >
                Free alt
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
            {rec.detail}
          </p>

          {rec.demandSignal && (
            <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
              <span className="font-medium text-[color:var(--color-ink)]">
                {nfmt.format(rec.demandSignal.searches)}
              </span>{" "}
              {t("demandSignal", {
                searches: nfmt.format(rec.demandSignal.searches),
                matches: nfmt.format(rec.demandSignal.matches),
              }).replace(/^[\d, ]+/, "")}
            </p>
          )}

          {/* Phase 9.12  Accept-to-learning button. Renders as a quiet
              "On your list" pill when the seeker has an active row. */}
          <div className="mt-4">
            <AcceptRecommendationButton
              skillSlug={rec.skill.slug}
              skillLabel={rec.skill.label}
              alreadyOnList={!!alreadyOnLearningList}
            />
          </div>
        </div>

        {rec.rankIfLearned && (
          <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-4 text-center md:min-w-[180px]">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
              Projected rank
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className="font-display tabular text-base text-[color:var(--color-ink-soft)] line-through">
                #{rec.rankIfLearned.current}
              </span>
              <ArrowUpRight
                className="size-4 text-[color:var(--color-brand)]"
                aria-hidden="true"
              />
              <span className="font-display tabular text-3xl text-[color:var(--color-brand-strong)]">
                #{rec.rankIfLearned.projected}
              </span>
            </div>
            <div className="mt-1 text-[0.62rem] text-[color:var(--color-ink-soft)]">
              in {rec.rankIfLearned.poolLabel}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function ReasonChip({
  reason,
  t,
}: {
  reason: GrowthReason;
  t: (k: string) => string;
}) {
  const palette: Record<GrowthReason, string> = {
    demand_high:
      "border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]",
    common_among_top_ranked:
      "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
    missing_for_role:
      "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]",
    adjacent_role:
      "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]",
  };
  return (
    <span
      className={
        "rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
        palette[reason]
      }
    >
      {t(`reason.${reason}`)}
    </span>
  );
}

function LearningPathCard({
  path,
  t,
}: {
  path: LearningPath;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            <ProviderChip kind={path.providerKind} />
            <CostChip cost={path.cost} />
            {path.national && (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2 py-0.5 text-[color:var(--color-ink-soft)]">
                <Globe2 className="size-3" aria-hidden="true" />
                {t("national")}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-lg">{path.title}</h3>
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            {path.provider}
          </p>
        </div>
        <GraduationCap
          className="size-5 shrink-0 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
      </header>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Duration
          </dt>
          <dd className="font-display tabular text-base">
            {t("duration", { weeks: path.durationWeeks })}
          </dd>
        </div>
        <div>
          <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {t("cost")}
          </dt>
          <dd className="text-sm">{path.costNote ?? COST_LABEL[path.cost]}</dd>
        </div>
      </dl>

      <p className="border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-sm">
        <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          {t("outcome")}:
        </span>{" "}
        {path.outcome}
      </p>

      {path.unlocksSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {path.unlocksSkills.map((s) => (
            <span
              key={s}
              className="rounded-[var(--radius-pill)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] text-[color:var(--color-ink)]"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Phase 11.2.1  outbound CTA. Honest fallback when no URL is on
          file: a quiet hint, not a dead button. The "Reviewed" chip
          (when set) sits next to the CTA  editorial trust signal. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[color:var(--color-hairline)] pt-3">
        {path.url ? (
          <OpenLearningPathButton
            url={path.url}
            title={path.title}
            provider={path.provider}
            providerKind={path.providerKind}
          />
        ) : (
          <p className="text-xs italic text-[color:var(--color-ink-soft)]">
            Provider link coming  search &ldquo;{path.title}&rdquo; on Google for now.
          </p>
        )}
        {path.sebenzaReviewed && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]"
            title="Sebenza editorial team reviewed this provider + course."
          >
            Reviewed
          </span>
        )}
      </div>
    </li>
  );
}

function ProviderChip({ kind }: { kind: LearningProviderKind }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[color:var(--color-ink)]">
      {PROVIDER_LABEL[kind]}
    </span>
  );
}

function CostChip({ cost }: { cost: LearningCost }) {
  const palette: Record<LearningCost, string> = {
    free: "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
    subsidised: "border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]",
    paid: "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 " +
        palette[cost]
      }
    >
      {COST_LABEL[cost]}
    </span>
  );
}

function AdjacentProfessionCard({
  adj,
  t,
  currentProfession,
}: {
  adj: AdjacentProfession;
  t: (k: string, v?: Record<string, string | number>) => string;
  currentProfession: string;
}) {
  const pct = Math.round(adj.overlap * 100);
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <header>
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Adjacent role
        </div>
        <h3 className="font-display text-lg">{adj.profession.label}</h3>
      </header>

      <div>
        <div className="flex items-baseline justify-between text-xs text-[color:var(--color-ink-soft)]">
          <span>{t("overlap", { percent: pct })}</span>
          <span className="font-display tabular text-base text-[color:var(--color-brand-strong)]">
            {pct}%
          </span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[color:var(--color-brand)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          {t("missing")}
        </div>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {adj.missingSkills.map((s) => (
            <li
              key={s}
              className="rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-2 py-0.5 text-[0.7rem] text-[color:var(--color-accent)]"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      {adj.demandHint && (
        <p className="border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs italic text-[color:var(--color-ink-soft)]">
          {adj.demandHint}
        </p>
      )}

      {/* Phase 11.2.8  pivot pathway. Opens a modal that explains the
          full consequence before the switch lands. Reversible from the
          profile editor; the modal copy makes that explicit. */}
      <div className="border-t border-dashed border-[color:var(--color-hairline)] pt-3">
        <AdjacentProfessionSwitch
          currentProfession={currentProfession}
          nextProfession={adj.profession.label}
        />
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Student lane  the academic-context section of the Career compass.

function StudentLane({
  academic,
  snapshot,
  locale,
  nfmt,
  t,
}: {
  academic: import("@/lib/mock/types").AcademicProfile;
  snapshot: ReturnType<typeof getStudentSnapshot>;
  locale: string;
  nfmt: Intl.NumberFormat;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const monthsLeft = Math.max(0, monthsUntil(academic.expectedGraduation));
  const gradFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(
    (() => {
      const [y, m] = academic.expectedGraduation.split("-").map(Number);
      return new Date(y ?? 2026, (m ?? 1) - 1, 1);
    })(),
  );

  return (
    <section
      aria-labelledby="student-h"
      className="mt-10 overflow-hidden rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)]"
    >
      {/* Lane header */}
      <header className="bg-[color:var(--color-ink)] p-6 text-[color:var(--color-paper)] md:p-10">
        <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-end">
          <span
            aria-hidden="true"
            className="inline-flex size-14 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-ink)]"
          >
            <GraduationCap className="size-7" />
          </span>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
              {t("lane")} · {academic.institutionLabel}
            </div>
            <h2
              id="student-h"
              className="mt-1 font-display text-3xl leading-tight md:text-4xl"
            >
              {t("headline")}
            </h2>
            <p className="mt-2 max-w-2xl text-[color:var(--color-paper)]/80">
              {t("subhead", { months: monthsLeft, programme: academic.programme })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-paper)]/60">
              {t("graduating")}
            </div>
            <div className="font-display tabular text-2xl">{gradFmt}</div>
            <div className="text-[0.62rem] text-[color:var(--color-paper)]/60">
              {monthsLeft} months · {snapshot.bridgeHeadline.slice(0, 0)}
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-12 bg-[color:var(--color-paper)] p-6 md:p-10">
        {/* Bridge headline */}
        <p className="font-display text-lg italic text-[color:var(--color-ink-soft)]">
          {snapshot.bridgeHeadline}
        </p>

        {/* Electives */}
        <section aria-labelledby="elec-h">
          <header className="mb-4 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
            <h3 id="elec-h" className="font-display text-xl">
              {t("electivesTitle")}
            </h3>
            <span className="hidden text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
              Inside your degree
            </span>
          </header>
          <p className="mb-4 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
            {t("electivesSub")}
          </p>
          <ul className="grid gap-4 md:grid-cols-3">
            {snapshot.electives.map((e, i) => (
              <ElectiveCard key={i} elective={e} nfmt={nfmt} t={t} />
            ))}
          </ul>
        </section>

        {/* Programmes */}
        <section aria-labelledby="prog-h">
          <header className="mb-4 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
            <h3 id="prog-h" className="font-display text-xl">
              {t("programmesTitle")}
            </h3>
            <span className="hidden text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
              Public sector listed first
            </span>
          </header>
          <p className="mb-4 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
            {t("programmesSub")}
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {snapshot.programmes.map((p, i) => (
              <ProgrammeCard key={i} programme={p} t={t} />
            ))}
          </ul>
        </section>

        {/* Destinations */}
        <section aria-labelledby="dest-h">
          <header className="mb-4 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
            <h3 id="dest-h" className="font-display text-xl">
              {t("destinationsTitle", { programme: academic.programme })}
            </h3>
            <span className="hidden text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
              From confirmed placements
            </span>
          </header>
          <p className="mb-4 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
            {t("destinationsSub")}
          </p>
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            {snapshot.destinations.map((d, i) => (
              <DestinationRow key={i} destination={d} nfmt={nfmt} t={t} />
            ))}
          </ul>
        </section>

        {/* Supplementary */}
        {snapshot.supplementarySkills.length > 0 && (
          <section aria-labelledby="supp-h">
            <header className="mb-3 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
              <h3 id="supp-h" className="font-display text-xl">
                {t("supplementaryTitle")}
              </h3>
            </header>
            <p className="mb-3 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
              {t("supplementarySub")}
            </p>
            <ul className="flex flex-wrap gap-2">
              {snapshot.supplementarySkills.map((s) => (
                <li
                  key={s.slug}
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
                >
                  {s.label}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}

function ElectiveCard({
  elective,
  nfmt,
  t,
}: {
  elective: ProgrammeElective;
  nfmt: Intl.NumberFormat;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
        Elective
      </div>
      <h4 className="mt-1 font-display text-lg">{elective.skill.label}</h4>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
        <span className="font-medium text-[color:var(--color-ink)]">
          {t("curriculumHint")}:
        </span>{" "}
        {elective.curriculumHint}
      </p>
      <p className="mt-3 text-sm">{elective.detail}</p>
      <p className="mt-3 border-t border-dashed border-[color:var(--color-hairline)] pt-2 text-xs text-[color:var(--color-ink-soft)]">
        {t("demandSignal", {
          searches: nfmt.format(elective.demandSignal.searches),
          matches: nfmt.format(elective.demandSignal.matches),
        })}
      </p>
    </li>
  );
}

function ProgrammeCard({
  programme,
  t,
}: {
  programme: OpportunityProgramme;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const Icon = SECTOR_ICON[programme.sector];
  const statusPalette = {
    open: "bg-[color:var(--color-brand)] text-white",
    closing_soon: "bg-[color:var(--color-accent)] text-[color:var(--color-ink)]",
    closed: "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]",
  }[programme.applicationStatus];

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5">
              <Icon className="size-3" aria-hidden="true" />
              {SECTOR_LABEL[programme.sector]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5">
              {PROGRAMME_KIND_LABEL[programme.kind]}
            </span>
            <span
              className={
                "rounded-[var(--radius-pill)] px-2 py-0.5 " + statusPalette
              }
            >
              {APPLICATION_STATUS_LABEL[programme.applicationStatus]}
            </span>
            {programme.saqaRecognised && (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[color:var(--color-brand-strong)]">
                {t("saqaChip")}
              </span>
            )}
          </div>
          <h4 className="mt-2 font-display text-lg">{programme.title}</h4>
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            {programme.organisation}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Duration
          </dt>
          <dd className="font-display tabular text-base">
            {t("duration", { months: programme.durationMonths })}
          </dd>
        </div>
        <div>
          <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Closing
          </dt>
          <dd className="text-sm">{programme.applicationHint}</dd>
        </div>
      </dl>

      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <MapPin className="mr-1 inline size-3" aria-hidden="true" />
          {programme.cities.join(" · ")}
        </div>
      </div>

      <p className="border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
        <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          {t("eligibility")}:
        </span>{" "}
        <span className="text-[color:var(--color-ink-soft)]">
          {programme.eligibility}
        </span>
      </p>
    </li>
  );
}

const SECTOR_ICON = {
  public: Landmark,
  corporate: Building2,
  ngo: Briefcase,
  startup: Briefcase,
} as const;

function DestinationRow({
  destination,
  nfmt,
  t,
}: {
  destination: GraduateDestination;
  nfmt: Intl.NumberFormat;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const pct = Math.round(destination.share * 100);
  return (
    <li className="grid grid-cols-1 gap-3 border-t border-[color:var(--color-hairline)] px-5 py-3 first:border-t-0 md:grid-cols-[1fr_auto_auto] md:items-center">
      <span>{destination.destination}</span>
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[color:var(--color-brand)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-display tabular text-base">{pct}%</span>
      </div>
      <span className="text-xs text-[color:var(--color-ink-soft)]">
        {destination.medianMonthsToPlacement
          ? t("medianMonths", { months: destination.medianMonthsToPlacement })
          : t("notPlaced")}
      </span>
    </li>
  );
}
