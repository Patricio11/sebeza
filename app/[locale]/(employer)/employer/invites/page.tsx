/**
 * Phase 9.17  Employer "Invites" dashboard.
 *
 * Three-section view (D9):
 *
 *   - Invite a candidate (the form  always at the top)
 *   - Pending  outstanding invitations; each row has Withdraw + Resend
 *   - Joined    seekers who completed sign-up via this invitation;
 *                each row links to the redacted public profile
 *                (same redaction every other employer sees)
 *   - Declined  invitations the recipient declined, optionally with
 *                their reason; 90-day cooldown badge per D7.2
 *
 * Gate: `verifyOrgVerified()`  same as every PII-touching surface.
 * Unverified employers get the existing onboarding redirect.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyOrgVerified } from "@/lib/auth/dal";
import { listOrgInvitations, type InviteListRow } from "@/lib/employer/seeker-invitations";
import { getProfessions } from "@/lib/taxonomy/query";
import { InviteSeekerForm } from "@/components/feature/employer/invites/InviteSeekerForm";
import { InvitationActions } from "@/components/feature/employer/invites/InvitationActions";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  Users2,
  XCircle,
} from "lucide-react";

export const metadata = { title: "Invites" };

export default async function EmployerInvitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyOrgVerified();

  const [groups, professions] = await Promise.all([
    listOrgInvitations(),
    getProfessions(),
  ]);

  const relTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  function relative(d: string | null | undefined): string {
    if (!d) return "";
    const at = new Date(d);
    const diffMs = Date.now() - at.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return relTime.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return relTime.format(-hrs, "hour");
    return relTime.format(-Math.round(hrs / 24), "day");
  }

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? MOCK_EMPLOYER.orgName}
      workspaceEyebrow={session.orgIndustry ?? MOCK_EMPLOYER.industry}
      nav={EMPLOYER_NAV}
      activeKey="invites"
      pageEyebrow="Roster building"
      pageTitle="Invites"
      pageSubtitle="Bring known candidates onto Sebenza, one email at a time. They control the signup; you get a clean audit trail."
    >
      <div className="space-y-10">
        <InviteSeekerForm professions={professions} />

        <Section
          title={`Pending  ${groups.pending.length}`}
          tone="brand"
          icon={Clock}
          emptyTitle="No pending invites."
          emptyNote="Send one above. Each invite is good for 14 days."
        >
          <ul className="space-y-3">
            {groups.pending.map((r) => (
              <PendingRow key={r.id} row={r} relative={relative} />
            ))}
          </ul>
        </Section>

        <Section
          title={`Joined  ${groups.joined.length}`}
          tone="accent"
          icon={Users2}
          emptyTitle="Nobody has joined yet."
          emptyNote="Once an invited candidate completes sign-up, they'll appear here. You'll see the same redacted profile every verified employer sees  no extra access."
        >
          <ul className="space-y-3">
            {groups.joined.map((r) => (
              <JoinedRow key={r.id} row={r} relative={relative} />
            ))}
          </ul>
        </Section>

        {groups.declined.length > 0 && (
          <Section
            title={`Declined  ${groups.declined.length}`}
            tone="danger"
            icon={XCircle}
            emptyTitle=""
            emptyNote=""
          >
            <p className="mb-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-2 text-xs text-[color:var(--color-ink-soft)]">
              POPIA §11  we respect every decline for at least 90 days
              from the decline date before allowing another invitation
              to the same email from your organisation.
            </p>
            <ul className="space-y-3">
              {groups.declined.map((r) => (
                <DeclinedRow key={r.id} row={r} relative={relative} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  tone,
  icon: Icon,
  emptyTitle,
  emptyNote,
  children,
}: {
  title: string;
  tone: "brand" | "muted" | "danger" | "accent";
  icon: typeof CheckCircle2;
  emptyTitle: string;
  emptyNote: string;
  children: React.ReactNode;
}) {
  const toneClass: Record<typeof tone, string> = {
    brand: "text-[color:var(--color-brand-strong)]",
    muted: "text-[color:var(--color-ink-soft)]",
    danger: "text-[color:var(--color-danger)]",
    accent: "text-[color:var(--color-accent)]",
  };
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <Icon className={`size-4 ${toneClass[tone]}`} aria-hidden="true" />
        <h2 className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </h2>
      </header>
      {children}
      {/* Empty-state copy renders when caller passes no children. We
          check React.Children at render time by relying on the empty
          <ul> the caller emits when its source list is []. The
          empty-state banner here covers the case where the section
          rendered nothing meaningful. */}
      {emptyTitle && (
        <div className="hidden first-of-type:block">
          <EmptyBanner title={emptyTitle} note={emptyNote} />
        </div>
      )}
    </section>
  );
}

function EmptyBanner({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
      <p className="font-display text-lg text-[color:var(--color-ink)]">{title}</p>
      <p className="mt-1">{note}</p>
    </div>
  );
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 2) return email;
  return `${email.slice(0, 2)}${"*".repeat(Math.max(1, at - 2))}${email.slice(at)}`;
}

function PendingRow({
  row,
  relative,
}: {
  row: InviteListRow;
  relative: (d: string | null) => string;
}) {
  return (
    <li className="grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
      <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]">
        <Mail className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-base text-[color:var(--color-ink)]">
            {row.name ?? maskEmail(row.email)}
          </span>
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            {row.email}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
          <span>Sent {relative(row.createdAt)}</span>
          {row.profession && (
            <>
              <span aria-hidden="true">·</span>
              <span>{row.profession}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>Expires {relative(row.expiresAt)}</span>
        </div>
      </div>
      <InvitationActions inviteId={row.id} email={row.email} />
    </li>
  );
}

function JoinedRow({
  row,
  relative,
}: {
  row: InviteListRow;
  relative: (d: string | null) => string;
}) {
  return (
    <li className="grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
      <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
        <Users2 className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          {row.acceptedHandle ? (
            <Link
              href={`/p/${row.acceptedHandle}` as never}
              className="font-display text-base text-[color:var(--color-brand)] hover:underline"
            >
              {row.acceptedDisplayName ?? row.email}
            </Link>
          ) : (
            <span className="font-display text-base text-[color:var(--color-ink)]">
              {row.acceptedDisplayName ?? row.email}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
          <span>Joined {relative(row.respondedAt)}</span>
          {row.profession && (
            <>
              <span aria-hidden="true">·</span>
              <span>Suggested: {row.profession}</span>
            </>
          )}
        </div>
      </div>
      {row.acceptedHandle && (
        <Link
          href={`/p/${row.acceptedHandle}` as never}
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-1 text-xs text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open profile
        </Link>
      )}
    </li>
  );
}

function DeclinedRow({
  row,
  relative,
}: {
  row: InviteListRow;
  relative: (d: string | null) => string;
}) {
  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-base text-[color:var(--color-ink)]">
          {maskEmail(row.email)}
        </span>
        <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-danger)]">
          90-day cooldown
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
        <span>Declined {relative(row.respondedAt)}</span>
      </div>
      {row.declineReason && (
        <blockquote className="mt-2 border-l-2 border-[color:var(--color-danger)] bg-[color:var(--color-paper)] px-3 py-1.5 text-xs italic text-[color:var(--color-ink)]">
          {row.declineReason}
        </blockquote>
      )}
    </li>
  );
}
