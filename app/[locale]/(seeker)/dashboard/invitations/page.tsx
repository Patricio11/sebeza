/**
 * Phase 9.8.5  Seeker invitations inbox.
 *
 * Lists every vacancy invitation for the signed-in seeker, newest
 * first. Mobile-first card list; each card carries the attribution
 * (employer + role), the current state, and a link to the per-
 * invitation detail page where the response actions live.
 *
 * Terminal-state rows (declined / expired / withdrawn) render at the
 * bottom in a dimmer panel so the active "Invited" rows have visual
 * priority. The seeker still benefits from seeing the full picture
 * (so silent withdrawals + expiries are surfaced as polite closure,
 * not as a missing notification).
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { listMyInvitations } from "@/lib/seeker/invitations";
import { PROVINCES, PROFESSIONS } from "@/lib/mock/taxonomy";
import { ChevronRight, Inbox, MapPin } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export const revalidate = 0;

const ACTIVE_STATES = new Set([
  "invited",
  "reconsidering",
  "accepted",
  "accepted_with_notice",
]);

export default async function SeekerInvitationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await verifyRole("seeker");

  const all = await listMyInvitations();
  const active = all.filter((i) => ACTIVE_STATES.has(i.state));
  const terminal = all.filter((i) => !ACTIVE_STATES.has(i.state));

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
      pageEyebrow="Inbox"
      pageTitle="Vacancy invites"
      pageSubtitle="Verified employers can flag you for a specific role. Accept, decline (with or without a reason), or accept with notice. Declining is free and never affects your visibility in search."
    >
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="vacancy-invitations-explained" label="How invitations work" />
        <HelpLink role="seeker" slug="how-to-accept-decline-or-reconsider" label="Accept, decline, reconsider" />
        <HelpLink role="seeker" slug="decline-reasons-and-what-they-mean" label="Decline reasons explained" />
      </div>

      {all.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section aria-labelledby="active-h">
              <h2
                id="active-h"
                className="mb-3 font-display text-xl text-[color:var(--color-ink)]"
              >
                Active · {active.length}
              </h2>
              <ul className="space-y-3">
                {active.map((inv) => (
                  <li key={inv.id}>
                    <InvitationCard inv={inv} dfmt={dfmt} active />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {terminal.length > 0 && (
            <section aria-labelledby="closed-h" className="opacity-90">
              <h2
                id="closed-h"
                className="mb-3 font-display text-xl text-[color:var(--color-ink-soft)]"
              >
                Closed · {terminal.length}
              </h2>
              <ul className="space-y-3">
                {terminal.map((inv) => (
                  <li key={inv.id}>
                    <InvitationCard inv={inv} dfmt={dfmt} active={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

const STATE_COPY: Record<
  string,
  { label: string; tone: "brand" | "accent" | "muted" | "danger" }
> = {
  invited: { label: "Invited  waiting for your response", tone: "brand" },
  accepted: { label: "Accepted", tone: "accent" },
  accepted_with_notice: { label: "Accepted (with notice)", tone: "accent" },
  declined: { label: "Declined", tone: "danger" },
  reconsidering: { label: "Reconsidering", tone: "brand" },
  withdrawn: { label: "Withdrawn by employer", tone: "muted" },
  expired: { label: "Expired without response", tone: "muted" },
};

const TONE_CLASS: Record<
  "brand" | "accent" | "muted" | "danger",
  string
> = {
  brand:
    "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
  accent:
    "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]",
  muted:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]",
  danger:
    "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
};

function InvitationCard({
  inv,
  dfmt,
  active,
}: {
  inv: Awaited<ReturnType<typeof listMyInvitations>>[number];
  dfmt: Intl.DateTimeFormat;
  active: boolean;
}) {
  const stateMeta = STATE_COPY[inv.state] ?? STATE_COPY.invited!;
  const professionLabel =
    PROFESSIONS.find((p) => p.slug === inv.professionSlug)?.label ??
    inv.professionSlug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === inv.provinceSlug)?.label ??
    inv.provinceSlug;

  const stateLabel = STATE_COPY[inv.state]?.label ?? inv.state;
  return (
    <Link
      href={`/dashboard/invitations/${inv.id}` as never}
      aria-label={`${stateLabel}  ${inv.vacancyTitle} at ${inv.orgName} in ${provinceLabel}. Open invitation details.`}
      className={
        "block rounded-[var(--radius-md)] border bg-[color:var(--color-surface)] p-4 transition-colors hover:border-[color:var(--color-ink)] md:p-5 " +
        (active
          ? "border-[color:var(--color-hairline)]"
          : "border-dashed border-[color:var(--color-hairline)]")
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {inv.orgName}
          </div>
          <h3 className="mt-0.5 font-display text-lg text-[color:var(--color-ink)]">
            {inv.vacancyTitle}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            {professionLabel}
            {inv.seniority ? `  ${inv.seniority}` : ""}
            {" · "}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {provinceLabel}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] ${TONE_CLASS[stateMeta.tone]}`}
            >
              {stateMeta.label}
            </span>
            <span className="text-xs text-[color:var(--color-ink-soft)]">
              Invited {dfmt.format(new Date(inv.invitedAt))}
              {inv.expiresAt &&
                inv.state === "invited" &&
                `  responds-by ${dfmt.format(new Date(inv.expiresAt))}`}
            </span>
          </div>
        </div>
        <ChevronRight
          className="size-5 shrink-0 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center md:p-12">
      <Inbox
        className="mx-auto size-8 text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <h2 className="mt-4 font-display text-xl">No invitations yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--color-ink-soft)]">
        When a verified employer flags you for a specific role, the
        invitation will land here  attributed by name, with the role
        + employer always visible. You&rsquo;ll also get a notification.
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-[color:var(--color-ink-soft)]">
        Only employers you&rsquo;ve granted <strong>Vacancy invites</strong>
        {" "}consent to can reach you this way. Adjust from your{" "}
        <Link
          href="/dashboard/privacy"
          className="underline hover:text-[color:var(--color-ink)]"
        >
          Privacy &amp; consent
        </Link>{" "}
        page any time.
      </p>
    </div>
  );
}
