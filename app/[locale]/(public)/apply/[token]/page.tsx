import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SAChevron } from "@/components/ui/SAChevron";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { ApplyIsland } from "@/components/feature/apply/ApplyIsland";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/dal";
import {
  getApplicantSalaryBand,
  getPublicVacancyByToken,
  getSeekerApplyState,
  selfApplyDisclosure,
} from "@/lib/vacancy/public";
import { WORK_AVAILABILITY_LABEL } from "@/components/feature/profile/WorkAvailabilityChips";
import type { VerificationStatus, WorkAvailabilityKind } from "@/lib/mock/types";
import {
  ArrowUpRight,
  Briefcase,
  Clock,
  MapPin,
  Users,
  GraduationCap,
} from "lucide-react";

/**
 * Phase 34 - the public Self Apply vacancy dossier
 * (docs/PHASE_34_SELF_APPLY_PLAN.md §34.5).
 *
 * The FIRST public vacancy surface in the codebase - a deliberate,
 * documented carve-out of the 9.8.8 org-private contract, addressed
 * only by the vacancy's unguessable token. Everything renders through
 * `lib/vacancy/public.ts` (the defined public subset; anonymous
 * payload never carries salary).
 *
 * No-enumeration rule: bad token, platform flag off, per-vacancy
 * toggle off, and closed/filled all render the SAME calm panel.
 *
 * Viewer-aware:
 *   anonymous        → Apply routes into /sign-up/apply/[token];
 *                       "Already on Sebenza?" → /sign-in?next=
 *   signed-in seeker → ApplyIsland (confirm + congrats dialogs);
 *                       salary line per D2
 *   employer/admin   → read-only note (they can't apply)
 */

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await getPublicVacancyByToken(token);
  // D3 - v1 is link-sharing only; never indexed, never in the sitemap.
  const robots = { index: false, follow: false };
  if (!result.ok) {
    return { title: "Open role", robots };
  }
  const v = result.vacancy;
  const title = `${v.title} · ${v.orgName}`;
  const description = `${v.orgName} is hiring: ${v.title} · ${v.locationLabel}. Apply free on Sebenza, South Africa's national talent platform.`;
  return {
    title,
    description,
    robots,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Sebenza",
      images: [
        {
          url: `/apply/${token}/card`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/apply/${token}/card`],
    },
  };
}

export default async function ApplyPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const result = await getPublicVacancyByToken(token);

  if (!result.ok) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="bg-[color:var(--color-paper)]">
          <UnavailablePanel />
        </main>
        <SiteFooter />
      </>
    );
  }

  const vacancy = result.vacancy;
  const viewer = await getSessionUser();

  // D2 - salary only for signed-in seekers, only while the employer
  // leaves it visible. Resolved server-side; the island just renders.
  const salaryBand =
    viewer?.role === "seeker" ? await getApplicantSalaryBand(token) : null;

  const applyState =
    viewer?.role === "seeker"
      ? await getSeekerApplyState(token, viewer.id)
      : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-[color:var(--color-paper)]">
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <header className="border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-[880px] px-5 py-10 md:py-16">
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              Open role · {vacancy.locationLabel}
            </div>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.015em] md:text-6xl">
              {vacancy.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-medium text-[color:var(--color-ink)]">
                {vacancy.orgName}
              </span>
              <VerificationBadge
                state={vacancy.orgVerification as VerificationStatus}
              />
            </div>

            {/* Fact chips - only what's actually set; nothing fabricated. */}
            <ul className="mt-6 flex flex-wrap gap-2">
              <FactChip
                icon={<Briefcase className="size-3.5" aria-hidden="true" />}
                label={vacancy.professionLabel}
              />
              <FactChip
                icon={<MapPin className="size-3.5" aria-hidden="true" />}
                label={vacancy.locationLabel}
              />
              {vacancy.seniority && (
                <FactChip
                  icon={<GraduationCap className="size-3.5" aria-hidden="true" />}
                  label={vacancy.seniority}
                />
              )}
              {vacancy.workAvailability.map((w) => (
                <FactChip
                  key={w}
                  icon={<Clock className="size-3.5" aria-hidden="true" />}
                  label={
                    WORK_AVAILABILITY_LABEL[w as WorkAvailabilityKind] ?? w
                  }
                />
              ))}
              {vacancy.positions != null && vacancy.positions > 1 && (
                <FactChip
                  icon={<Users className="size-3.5" aria-hidden="true" />}
                  label={`${vacancy.positions} positions`}
                />
              )}
              {vacancy.minYearsExperience != null &&
                vacancy.minYearsExperience > 0 && (
                  <FactChip
                    icon={<Clock className="size-3.5" aria-hidden="true" />}
                    label={`${vacancy.minYearsExperience}+ years experience`}
                  />
                )}
            </ul>
          </div>
        </header>

        <div className="mx-auto grid max-w-[880px] gap-10 px-5 py-10 md:py-14">
          {/* ── Description ───────────────────────────────────────────── */}
          {vacancy.description && (
            <section aria-labelledby="about-h">
              <SectionHeading id="about-h">About the role</SectionHeading>
              <p className="max-w-2xl whitespace-pre-line leading-relaxed text-[color:var(--color-ink)]">
                {vacancy.description}
              </p>
            </section>
          )}

          {/* ── Skills ────────────────────────────────────────────────── */}
          {vacancy.skills.length > 0 && (
            <section aria-labelledby="skills-h">
              <SectionHeading id="skills-h">
                Skills this employer is looking for
              </SectionHeading>
              <ul className="flex max-w-2xl flex-wrap gap-2">
                {vacancy.skills.map((s) => (
                  <li
                    key={s.slug}
                    className="rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-4 py-1.5 text-sm text-[color:var(--color-ink)]"
                  >
                    {s.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Salary (D2: signed-in seekers only, employer-controlled) ── */}
          {salaryBand && (
            <section aria-labelledby="salary-h">
              <SectionHeading id="salary-h">Salary band</SectionHeading>
              <p className="font-display text-2xl text-[color:var(--color-ink)]">
                {salaryBand}
              </p>
            </section>
          )}

          {/* ── The apply moment ──────────────────────────────────────── */}
          <section
            aria-labelledby="apply-h"
            className="rounded-[var(--radius-lg)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-6 md:p-8"
          >
            <SectionHeading id="apply-h">Apply for this role</SectionHeading>

            {!viewer && (
              <div className="grid gap-4">
                <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                  Applying is free. Create your Sebenza profile once. This
                  employer reviews it for this role, and you stay findable
                  for every other opportunity on the national platform.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/sign-up/apply/${token}`}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-7 py-3.5 text-sm font-medium text-[color:var(--color-surface)] shadow-press transition-transform hover:-translate-y-0.5"
                  >
                    Apply now
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(`/apply/${token}`)}`}
                    className="text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
                  >
                    Already on Sebenza? Sign in
                  </Link>
                </div>
              </div>
            )}

            {viewer?.role === "seeker" && (
              <ApplyIsland
                token={token}
                vacancyTitle={vacancy.title}
                orgName={vacancy.orgName}
                locationLabel={vacancy.locationLabel}
                salaryBand={salaryBand}
                initialState={
                  applyState?.kind === "already_applied"
                    ? "already_applied"
                    : applyState?.kind === "already_invited"
                      ? "already_invited"
                      : "can_apply"
                }
                initialInvitationId={
                  applyState && "invitationId" in applyState
                    ? applyState.invitationId
                    : null
                }
                disclosure={selfApplyDisclosure(vacancy.orgName)}
              />
            )}

            {viewer && viewer.role !== "seeker" && (
              <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                You&rsquo;re signed in as{" "}
                {viewer.role === "employer" ? "an employer" : viewer.role}.
                Only job seekers can apply. Share this link with someone
                looking for work.
              </p>
            )}
          </section>

          {/* ── Trust strip - the same promises as the landing page ────── */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[color:var(--color-hairline)] pt-5 text-[0.68rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            <span>Free for job seekers</span>
            <span aria-hidden="true">·</span>
            <span>POPIA-first</span>
            <span aria-hidden="true">·</span>
            <span>Powered by Sebenza</span>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl text-[color:var(--color-ink)]"
    >
      {children}
    </h2>
  );
}

function FactChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-1.5 text-xs text-[color:var(--color-ink)]">
      <span className="text-[color:var(--color-brand-strong)]">{icon}</span>
      {label}
    </li>
  );
}

/**
 * ONE calm panel for every unavailable state (bad token / flag off /
 * toggle off / closed / filled) - indistinguishable by design, so the
 * URL space can't be probed. 200, never notFound (report-invite
 * precedent).
 */
function UnavailablePanel() {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-16 md:py-24">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
        <SAChevron variant="mark" className="size-3" />
        Open role
      </div>
      <h1 className="mt-3 font-display text-4xl leading-tight">
        This role isn&rsquo;t accepting applications
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-[color:var(--color-ink-soft)]">
        The link may have been switched off by the employer, or the vacancy
        may have been filled or closed. If someone sent you this link, let
        them know it&rsquo;s no longer active.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-surface)] shadow-press transition-transform hover:-translate-y-0.5"
        >
          Browse the talent platform
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href="/sign-up/seeker"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-surface)]"
        >
          Create a free profile
        </Link>
      </div>
    </div>
  );
}
