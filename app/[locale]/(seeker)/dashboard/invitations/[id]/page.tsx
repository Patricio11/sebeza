/**
 * Phase 9.8.5  Seeker invitation detail + response actions.
 *
 * Landing page for the `/dashboard/invitations/${invitationId}` link
 * carried by every `vacancy.invite*` notification. Renders the
 * vacancy + employer attribution, the lifecycle state, and the
 * action area (`InvitationResponseIsland`).
 *
 * The action surface is state-aware (accept / decline / accept-with-
 * notice on `invited`, reconsider on `declined`, static panels on
 * terminal states)  the island handles every branch so this page
 * stays a thin server shell.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";

import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyInvitation } from "@/lib/seeker/invitations";
import { InvitationResponseIsland } from "@/components/feature/seeker/invitations/InvitationResponseIsland";
import { VacancySnapshotCard } from "@/components/feature/seeker/invitations/VacancySnapshotCard";
import { EmployerVerificationChip } from "@/components/feature/seeker/invitations/EmployerVerificationChip";
import { BlockEmployerControl } from "@/components/feature/seeker/BlockEmployerControl";
import { ReportInvitationControl } from "@/components/feature/seeker/ReportInvitationControl";
import { FollowEmployerButton } from "@/components/feature/seeker/FollowEmployerButton";
import { isFollowingEmployer } from "@/lib/seeker/follows";
import { PROFESSIONS } from "@/lib/mock/taxonomy";
import { formatVacancyLocation } from "@/lib/employer/vacancies-display";
import type { WorkAvailabilityKind } from "@/lib/mock/types";
import {
  Building2,
  ChevronLeft,
  Clock,
  MapPin,
  BookOpen,
  FileText,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";

export const revalidate = 0;

export default async function SeekerInvitationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await verifyRole("seeker");

  const inv = await getMyInvitation(id);
  if (!inv) notFound();

  // Phase 15.3.1  readiness surfaces only while the invitation is live
  // or accepted; never on a decline / expiry / withdrawal (D4: right
  // moment, no nag).
  const tReady = await getTranslations("seekerDash.workReady");
  const showPrepare = (
    ["invited", "reconsidering", "accepted", "accepted_with_notice"] as const
  ).includes(inv.state as never);

  // Phase 11.4.2  follow-state read for the heart button.
  const following = await isFollowingEmployer(inv.orgId);

  const professionLabel =
    PROFESSIONS.find((p) => p.slug === inv.professionSlug)?.label ??
    inv.professionSlug;
  // Phase 13.9  unified location formatter.
  const provinceLabel = formatVacancyLocation({
    provinceSlug: inv.provinceSlug,
    citySlug: inv.citySlug,
    workAvailability:
      (inv.workAvailability as WorkAvailabilityKind[]) ?? [],
  });

  const dfmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <DashboardMasthead
      role="seeker"
      workspaceLabel={user.name}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="invitations"
      pageEyebrow="Invitation"
      pageTitle={inv.vacancyTitle}
      pageSubtitle={`${inv.orgName}  ${professionLabel}${inv.seniority ? `, ${inv.seniority}` : ""}  ${provinceLabel}`}
    >
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/invitations"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to inbox
        </Link>
      </div>

      {/* Attribution + role panel  always rendered, regardless of
          state. Honest, attributed, never anonymous. */}
      <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          From
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-display text-xl text-[color:var(--color-ink)]">
          <Building2 className="size-5" aria-hidden="true" />
          {inv.orgName}
          {/* Phase 11.3.5  verification chip + honest-signal line when
              the org isn't verified. */}
          <EmployerVerificationChip
            state={inv.orgVerification}
            withDetail
          />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Role
            </dt>
            <dd className="mt-1 font-display text-base text-[color:var(--color-ink)]">
              {inv.vacancyTitle}
            </dd>
            <dd className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
              {professionLabel}
              {inv.seniority ? `  ${inv.seniority}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Location
            </dt>
            <dd className="mt-1 inline-flex items-center gap-1 text-[color:var(--color-ink)]">
              <MapPin className="size-4" aria-hidden="true" />
              {provinceLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Sent
            </dt>
            <dd className="mt-1 text-[color:var(--color-ink)]">
              {dfmt.format(new Date(inv.invitedAt))}
            </dd>
          </div>
          {inv.expiresAt && inv.state === "invited" && (
            <div>
              <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Responds by
              </dt>
              <dd className="mt-1 inline-flex items-center gap-1 text-[color:var(--color-ink)]">
                <Clock className="size-4" aria-hidden="true" />
                {dfmt.format(new Date(inv.expiresAt))}
              </dd>
            </div>
          )}
          {/* Phase 9.21  surface the season window when the vacancy
              declared one. Informational only (D5)  the seeker reads
              the months and decides; nothing here is a filter. */}
          {inv.seasonalWindow && (
            <div>
              <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Season window
              </dt>
              <dd className="mt-1 text-[color:var(--color-ink)]">
                {formatSeasonalWindowLabel(inv.seasonalWindow)}
              </dd>
            </div>
          )}
        </dl>

        {inv.description && !inv.vacancySnapshot && (
          <div className="mt-5 border-t border-[color:var(--color-hairline)] pt-4">
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              About the role
            </dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--color-ink)]">
              {inv.description}
            </dd>
          </div>
        )}
      </section>

      {/* Phase 11.3.4  vacancy snapshot card. Frozen-at-send spec
          when one exists; falls back to the live description for
          pre-migration invitations. */}
      <VacancySnapshotCard
        snapshot={inv.vacancySnapshot}
        liveDescription={inv.description}
        liveProfession={professionLabel}
        liveProvince={provinceLabel}
        locale={locale}
      />

      <InvitationResponseIsland
        invitationId={inv.id}
        state={inv.state}
        orgName={inv.orgName}
        vacancyTitle={inv.vacancyTitle}
        noticePeriodMonths={inv.noticePeriodMonths}
        declineReason={inv.declineReason}
        declineNote={inv.declineNote}
      />

      {/* Phase 15.3.1  "Prepare for this role": calm, contextual
          readiness at the right moment. Reuses the Phase 15.1 guides +
          the CV builder. Hidden once the invitation is closed. */}
      {showPrepare && (
        <section
          aria-labelledby="prepare-h"
          className="mt-6 rounded-[var(--radius-md)] border-l-4 border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-5 md:p-6"
        >
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
            {tReady("eyebrow")}
          </p>
          <h2
            id="prepare-h"
            className="mt-1 font-display text-lg text-[color:var(--color-ink)]"
          >
            {tReady("prepareTitle")}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {tReady("prepareLead")}
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            <PrepareLink
              href="/dashboard/help/prepare-for-an-interview"
              icon={<BookOpen className="size-4" aria-hidden="true" />}
              label={tReady("prepareInterview")}
            />
            <PrepareLink
              href="/dashboard/cv"
              icon={<FileText className="size-4" aria-hidden="true" />}
              label={tReady("prepareCv")}
            />
            <PrepareLink
              href="/dashboard/help/spotting-job-scams"
              icon={<ShieldAlert className="size-4" aria-hidden="true" />}
              label={tReady("prepareScams")}
            />
          </ul>
        </section>
      )}

      {/* Phase 11.3.2 + 11.3.3 + 11.4.2  agency controls. Report
          fires a moderation row; block silences this org platform-
          wide for this seeker; follow saves the org to your private
          warm-intent list (the employer is never told). */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4">
        <ReportInvitationControl invitationId={inv.id} />
        <BlockEmployerControl orgId={inv.orgId} orgName={inv.orgName} />
        <FollowEmployerButton
          orgId={inv.orgId}
          initialFollowing={following}
          variant="icon"
        />
      </div>

      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        Salary band, internal notes, and the employer&rsquo;s candidate
        pipeline are private to the organisation  this invitation is
        the only thing they&rsquo;ve sent you. Declining never affects
        your search visibility, and you can withdraw <strong>Vacancy
        invites</strong> consent any time from your{" "}
        <Link
          href="/dashboard/privacy"
          className="underline hover:text-[color:var(--color-ink)]"
        >
          Privacy &amp; consent
        </Link>{" "}
        page.
      </p>
    </DashboardMasthead>
  );
}

/**
 * Phase 15.3.1  one readiness link in the "Prepare for this role"
 * card. White chip, ≥44px tap target, wraps to one column on a phone.
 */
function PrepareLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href as never}
        className="group flex min-h-[44px] items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-ink)] no-underline transition-colors hover:border-[color:var(--color-ink)]"
      >
        <span className="inline-flex items-center gap-2">
          <span className="text-[color:var(--color-brand-strong)]">{icon}</span>
          {label}
        </span>
        <ArrowUpRight
          className="size-3.5 shrink-0 text-[color:var(--color-ink-soft)] transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/**
 * Phase 9.21  short human label for a vacancy's season window.
 * Mirrors the employer-side helper in
 * `app/[locale]/(employer)/employer/vacancies/[id]/page.tsx`. The
 * two helpers stay in lockstep deliberately  the seeker reads
 * exactly what the employer published.
 */
function formatSeasonalWindowLabel(
  window: import("@/lib/mock/types").SeasonalWindow,
): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const startMonth = months[window.startMonth - 1] ?? "?";
  const endMonth = months[window.endMonth - 1] ?? "?";
  // Phase 9.21 follow-up  surface anchor year when the employer set
  // it. Seeker reads "Nov 2026  Feb 2027" rather than the ambiguous
  // month-only "Nov  Feb" for windows that cross December.
  const start = window.startYear ? `${startMonth} ${window.startYear}` : startMonth;
  const end = window.endYear ? `${endMonth} ${window.endYear}` : endMonth;
  const sameMonthAndYear =
    window.startMonth === window.endMonth &&
    (window.startYear ?? null) === (window.endYear ?? null);
  const range = sameMonthAndYear ? start : `${start}${end}`;
  const tail = window.recurringAnnually ? ", annually" : ", one-off";
  return `${range}${tail}`;
}
