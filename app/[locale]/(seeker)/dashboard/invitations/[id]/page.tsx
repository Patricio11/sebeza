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

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyInvitation } from "@/lib/seeker/invitations";
import { InvitationResponseIsland } from "@/components/feature/seeker/invitations/InvitationResponseIsland";
import { PROVINCES, PROFESSIONS } from "@/lib/mock/taxonomy";
import { Building2, ChevronLeft, Clock, MapPin } from "lucide-react";

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

  const professionLabel =
    PROFESSIONS.find((p) => p.slug === inv.professionSlug)?.label ??
    inv.professionSlug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === inv.provinceSlug)?.label ??
    inv.provinceSlug;

  const dfmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <DashboardShell
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
        <div className="mt-1 flex items-center gap-2 font-display text-xl text-[color:var(--color-ink)]">
          <Building2 className="size-5" aria-hidden="true" />
          {inv.orgName}
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

        {inv.description && (
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

      <InvitationResponseIsland
        invitationId={inv.id}
        state={inv.state}
        orgName={inv.orgName}
        vacancyTitle={inv.vacancyTitle}
        noticePeriodMonths={inv.noticePeriodMonths}
        declineReason={inv.declineReason}
        declineNote={inv.declineNote}
      />

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
    </DashboardShell>
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
  const start = months[window.startMonth - 1] ?? "?";
  const end = months[window.endMonth - 1] ?? "?";
  const range =
    window.startMonth === window.endMonth ? start : `${start}${end}`;
  const tail = window.recurringAnnually ? ", annually" : ", one-off";
  return `${range}${tail}`;
}
