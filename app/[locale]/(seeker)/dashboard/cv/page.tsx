/**
 * Phase 15.2  CV builder.
 *
 * Renders a clean, printable CV from the seeker's OWN profile data
 * (getMyProfile) using the print-CSS pattern from `/insights/print`
 * (D2 in PHASE_15_PLAN.md)  no server-side PDF dependency, browser-
 * native "Save as PDF". Seeker-only; the generated CV is never an
 * employer surface, never indexed, never auto-shared (same privacy
 * rule as the 11.5.2 CV backup).
 *
 * Verification-Honesty (D-honesty / 15.2.4): skills show the seeker's
 * own rating with a plain "self-rated" footnote  never stamped
 * "verified"; qualifications show their REAL verification state. The CV
 * tells the same story as `/p/<handle>`.
 *
 * Two layouts via `?template=` (D2): `classic` (single column, most
 * ATS-parseable  the default) and `compact` (two columns on a larger
 * screen + in print, one column on a phone). Renders only the sections
 * the seeker actually has  honest end-states, no empty headings.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ArrowUpRight } from "lucide-react";
import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile, type MyProfile } from "@/lib/profile/me";
import { CvPrintButton } from "@/components/feature/seeker/CvPrintButton";
import type { SkillRef } from "@/lib/mock/types";

export const metadata = {
  title: "Build your CV  Sebenza",
  robots: { index: false, follow: false },
};

type Template = "classic" | "compact";

export default async function CvBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/cv");
  const t = await getTranslations("seekerDash.cv");

  const sp = await searchParams;
  const template: Template = sp.template === "compact" ? "compact" : "classic";

  const hasAnyContent =
    me.topSkills.length > 0 ||
    (me.experience?.length ?? 0) > 0 ||
    (me.qualifications?.length ?? 0) > 0 ||
    !!me.bio ||
    !!me.academic;

  return (
    <div className="min-h-screen bg-[color:var(--color-surface-sunk)] print:bg-white">
      {/* ── Control bar (never printed) ─────────────────────────────── */}
      <div className="no-print border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
        <div className="mx-auto flex max-w-[880px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
          >
            <ChevronLeft className="size-3" aria-hidden="true" />
            {t("back")}
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label={t("layout")}
              className="inline-flex rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-0.5"
            >
              <TemplateTab
                active={template === "classic"}
                href="/dashboard/cv?template=classic"
                label={t("templateClassic")}
              />
              <TemplateTab
                active={template === "compact"}
                href="/dashboard/cv?template=compact"
                label={t("templateCompact")}
              />
            </div>
            <CvPrintButton label={t("print")} />
          </div>
        </div>
        <div className="mx-auto max-w-[880px] px-4 pb-3 md:px-6">
          <p className="text-xs text-[color:var(--color-ink-soft)]">{t("printHint")}</p>
        </div>
      </div>

      {/* ── The CV "paper" ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-[880px] px-4 py-6 md:px-6 md:py-10 print:p-0">
        <article
          className="mx-auto max-w-[820px] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-white p-6 text-black shadow-sm md:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
          aria-label={t("pageTitle")}
        >
          <CvHeader me={me} t={t} />

          {!hasAnyContent ? (
            <EmptyCv t={t} />
          ) : template === "compact" ? (
            <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-[1fr_minmax(0,220px)] print:grid-cols-[1fr_220px]">
              <div className="min-w-0 space-y-6 md:order-1 print:order-1">
                {me.bio && <AboutSection bio={me.bio} t={t} />}
                <ExperienceSection me={me} locale={locale} t={t} />
                <StudiesSection me={me} t={t} />
              </div>
              <div className="min-w-0 space-y-6 md:order-2 print:order-2">
                <SkillsSection skills={me.topSkills} t={t} />
                <QualificationsSection me={me} t={t} />
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {me.bio && <AboutSection bio={me.bio} t={t} />}
              <SkillsSection skills={me.topSkills} t={t} />
              <ExperienceSection me={me} locale={locale} t={t} />
              <QualificationsSection me={me} t={t} />
              <StudiesSection me={me} t={t} />
            </div>
          )}

          <CvFooter me={me} t={t} />
        </article>

        {/* Save-to-backup bridge (15.2.5)  never printed. */}
        <div className="no-print mx-auto mt-6 max-w-[820px] rounded-[var(--radius-md)] border-l-4 border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-4 md:p-5">
          <p className="font-display text-base text-[color:var(--color-ink)]">
            {t("backupNoteTitle")}
          </p>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {t("backupNoteBody")}
          </p>
          <Link
            href="/dashboard/profile#cv-backup"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[color:var(--color-brand-strong)] no-underline hover:underline"
          >
            {t("backupNoteCta")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Print rules: A4, app chrome gone, paper edge-to-edge. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          body { background: #fff; }
          .no-print, .no-print * { display: none !important; }
        }
        .cv-break-avoid { page-break-inside: avoid; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────

type T = Awaited<ReturnType<typeof getTranslations>>;

function TemplateTab({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href as never}
      aria-current={active ? "true" : undefined}
      className={
        "inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] px-4 text-sm no-underline transition-colors " +
        (active
          ? "bg-[color:var(--color-ink)] font-medium text-[color:var(--color-paper)]"
          : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
      }
    >
      {label}
    </Link>
  );
}

function CvHeader({ me, t }: { me: MyProfile; t: T }) {
  const professionLine = [me.seniority, me.profession]
    .filter(Boolean)
    .join(" · ");
  const contactBits = [
    [me.city, me.province].filter(Boolean).join(", "),
    me.email,
  ].filter(Boolean);
  return (
    <header className="border-b-2 border-black pb-4">
      <h1 className="font-display text-3xl leading-tight md:text-4xl">
        {me.displayName}
      </h1>
      {professionLine && (
        <p className="mt-1 text-base text-neutral-700">{professionLine}</p>
      )}
      {(me.secondaryProfessions?.length ?? 0) > 0 && (
        <p className="mt-1 text-sm text-neutral-600">
          {t("alsoExperiencedIn")}: {me.secondaryProfessions!.join(" · ")}
        </p>
      )}
      {contactBits.length > 0 && (
        <p className="mt-2 text-sm text-neutral-700">
          {contactBits.join("  ·  ")}
        </p>
      )}
    </header>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 border-b border-neutral-300 pb-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-neutral-600">
      {children}
    </h2>
  );
}

function AboutSection({ bio, t }: { bio: string; t: T }) {
  return (
    <section className="cv-break-avoid">
      <SectionHeading>{t("sectionAbout")}</SectionHeading>
      <p className="text-[0.92rem] leading-relaxed text-neutral-800">{bio}</p>
    </section>
  );
}

function SkillsSection({ skills, t }: { skills: SkillRef[]; t: T }) {
  if (skills.length === 0) return null;
  // Strongest first, then most-experienced  honest ordering, no
  // "N/5" clutter on the page (the self-rated footnote carries the
  // honesty per 15.2.4).
  const sorted = [...skills].sort(
    (a, b) =>
      b.proficiency - a.proficiency ||
      (b.yearsOfExperience ?? 0) - (a.yearsOfExperience ?? 0),
  );
  return (
    <section className="cv-break-avoid">
      <SectionHeading>{t("sectionSkills")}</SectionHeading>
      <ul className="space-y-1">
        {sorted.map((s) => {
          const yrs =
            s.yearsOfExperience != null && s.yearsOfExperience > 0
              ? t(s.yearsOfExperience === 1 ? "skillYears" : "skillYearsPlural", {
                  years: s.yearsOfExperience,
                })
              : null;
          return (
            <li
              key={s.name}
              className="flex items-baseline justify-between gap-3 text-[0.9rem]"
            >
              <span className="font-medium text-neutral-900">{s.name}</span>
              {yrs && (
                <span className="shrink-0 text-xs text-neutral-500">{yrs}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[0.7rem] italic text-neutral-500">
        {t("honestNote")}
      </p>
    </section>
  );
}

function ExperienceSection({
  me,
  locale,
  t,
}: {
  me: MyProfile;
  locale: string;
  t: T;
}) {
  const items = me.experience ?? [];
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading>{t("sectionExperience")}</SectionHeading>
      <div className="space-y-4">
        {items.map((e, i) => {
          const range = [
            fmtMonth(e.startedAt, locale),
            e.endedAt ? fmtMonth(e.endedAt, locale) : t("present"),
          ]
            .filter(Boolean)
            .join("  ");
          return (
            <div key={`${e.role}-${e.organization}-${i}`} className="cv-break-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-display text-[1.02rem] text-neutral-900">
                  {e.role}
                  {e.organization && (
                    <span className="font-body text-[0.92rem] font-normal text-neutral-700">
                      {" "}
                      · {e.organization}
                    </span>
                  )}
                </p>
                {range && (
                  <p className="text-xs text-neutral-500">{range}</p>
                )}
              </div>
              {e.city && (
                <p className="text-xs text-neutral-500">{e.city}</p>
              )}
              {e.description && (
                <p className="mt-1 text-[0.9rem] leading-relaxed text-neutral-800">
                  {e.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QualificationsSection({ me, t }: { me: MyProfile; t: T }) {
  const items = me.qualifications ?? [];
  if (items.length === 0) return null;
  return (
    <section className="cv-break-avoid">
      <SectionHeading>{t("sectionQualifications")}</SectionHeading>
      <div className="space-y-3">
        {items.map((q, i) => (
          <div key={`${q.title}-${i}`}>
            <p className="text-[0.92rem] font-medium text-neutral-900">
              {q.title}
            </p>
            <p className="text-xs text-neutral-600">
              {[q.institution, q.awardedYear ?? null]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-neutral-500">
              {q.verification === "verified"
                ? t("qualVerified")
                : q.verification === "pending"
                  ? t("qualPending")
                  : t("qualSelfListed")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudiesSection({ me, t }: { me: MyProfile; t: T }) {
  const a = me.academic;
  if (!a) return null;
  return (
    <section className="cv-break-avoid">
      <SectionHeading>{t("sectionStudies")}</SectionHeading>
      <p className="text-[0.92rem] font-medium text-neutral-900">
        {t("studyingAt", {
          programme: a.programme,
          institution: a.institutionLabel,
        })}
      </p>
      <p className="text-xs text-neutral-600">
        {[
          a.nqfLevel ? t("nqfLevel", { level: a.nqfLevel }) : null,
          a.expectedGraduation
            ? t("expectedGrad", { date: a.expectedGraduation })
            : null,
        ]
          .filter(Boolean)
          .join("  ·  ")}
      </p>
    </section>
  );
}

function CvFooter({ me, t }: { me: MyProfile; t: T }) {
  return (
    <footer className="mt-8 border-t border-neutral-300 pt-3 text-[0.7rem] text-neutral-500">
      {t("generatedWith", { url: `sebenzasa.com/p/${me.handle}` })}
    </footer>
  );
}

function EmptyCv({ t }: { t: T }) {
  return (
    <div className="no-print mt-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-6 text-center">
      <p className="font-display text-lg text-[color:var(--color-ink)]">
        {t("emptyTitle")}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--color-ink-soft)]">
        {t("emptyBody")}
      </p>
      <Link
        href="/dashboard/profile"
        className="mt-4 inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] no-underline hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
      >
        {t("emptyCta")}
      </Link>
    </div>
  );
}

/**
 * "yyyy-mm"  localized "MMM yyyy". Deterministic (explicit UTC date,
 * no current-time read), so it's safe in a server render.
 */
function fmtMonth(yyyymm: string | null | undefined, locale: string): string {
  if (!yyyymm) return "";
  const [y, m] = yyyymm.split("-").map((n) => Number(n));
  if (!y) return yyyymm;
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
