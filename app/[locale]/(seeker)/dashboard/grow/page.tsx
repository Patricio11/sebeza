import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { Button } from "@/components/ui/Button";
import { dataProvider } from "@/lib/data/provider";
import {
  getCompassForHandle,
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
} from "lucide-react";

const MOCK_HANDLE = "andile-z";

export default async function CareerCompassPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;

  const t = await getTranslations("seekerDash.grow");
  const tStudent = await getTranslations("seekerDash.grow.student");
  const compass = getCompassForHandle(me.handle);
  const student = me.academic ? getStudentSnapshot(me.academic) : null;
  const nfmt = new Intl.NumberFormat(locale);

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="grow"
      pageEyebrow={t("eyebrow")}
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
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
            <RecommendationItem key={rec.skill.slug} rec={rec} ordinal={i + 1} nfmt={nfmt} t={t} />
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
            <AdjacentProfessionCard key={i} adj={adj} t={t} />
          ))}
        </ul>
      </section>

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
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
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
                return (
                  <tr
                    key={i}
                    className="border-t border-[color:var(--color-hairline)]"
                  >
                    <td className="px-5 py-3">{row.skill}</td>
                    <td className="px-5 py-3 tabular text-right">
                      {nfmt.format(row.searches)}
                    </td>
                    <td className="px-5 py-3 tabular text-right text-[color:var(--color-ink-soft)]">
                      {nfmt.format(row.matches)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <div
                          className="h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full bg-[color:var(--color-accent)]"
                            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                          />
                        </div>
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
    </DashboardShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function RecommendationItem({
  rec,
  ordinal,
  nfmt,
  t,
}: {
  rec: SkillRecommendation;
  ordinal: number;
  nfmt: Intl.NumberFormat;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
      <div className="grid gap-4 md:grid-cols-[2.5rem_1fr_auto] md:items-start">
        <span className="font-display text-[1.75rem] italic leading-none text-[color:var(--color-accent)]">
          {ordinal.toString().padStart(2, "0")}
        </span>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl text-[color:var(--color-ink)]">
              {rec.skill.label}
            </h3>
            <ReasonChip reason={rec.reason} t={t} />
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
}: {
  adj: AdjacentProfession;
  t: (k: string, v?: Record<string, string | number>) => string;
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
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Student lane — the academic-context section of the Career compass.

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
