/**
 * Phase 11.1.3  welcome-back delta card.
 *
 * Renders at the top of /dashboard when the seeker returns after an
 * absence >= 7 days. Surfaces what changed while they were gone:
 * profile views, contact reveals, new invitations. The data is
 * composed from existing reads (getSeekerActivity KPIs); no new
 * query.
 *
 * Suppression rules:
 *   - Hidden when all the delta numbers are zero (nothing-changed
 *     is its own honest signal but doesn't need a card).
 *   - Hidden when the absence cookie suggests < 7 days  the helper
 *     `readAndSetLastSeen` returns null in that case.
 *
 * Civic-Editorial constraints: brand-tint background, ordinal-style
 * number display, no animation. Matches the existing
 * PendingInvitesCallout visual language.
 */

import { Eye, MessageCircle, Inbox, TrendingUp } from "lucide-react";

interface Props {
  absenceDays: number;
  viewers: number;
  contacts: number;
  newInvites: number;
}

export function WelcomeBackCard({
  absenceDays,
  viewers,
  contacts,
  newInvites,
}: Props) {
  const totalDelta = viewers + contacts + newInvites;
  if (totalDelta === 0) return null;
  return (
    <section
      aria-labelledby="wb-h"
      className="mb-4 rounded-[var(--radius-md)] border-l-4 border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-4 md:p-5"
    >
      <header className="mb-3 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
        <TrendingUp className="size-3.5" aria-hidden="true" />
        While you were away ({absenceDays} day{absenceDays === 1 ? "" : "s"})
      </header>
      <h2 id="wb-h" className="sr-only">
        Welcome-back summary
      </h2>
      <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {viewers > 0 && (
          <DeltaItem
            icon={<Eye className="size-4" aria-hidden="true" />}
            value={viewers}
            label={`employer${viewers === 1 ? "" : "s"} viewed you`}
          />
        )}
        {contacts > 0 && (
          <DeltaItem
            icon={<MessageCircle className="size-4" aria-hidden="true" />}
            value={contacts}
            label={`new contact${contacts === 1 ? "" : "s"}`}
          />
        )}
        {newInvites > 0 && (
          <DeltaItem
            icon={<Inbox className="size-4" aria-hidden="true" />}
            value={newInvites}
            label={`vacancy invite${newInvites === 1 ? "" : "s"}`}
          />
        )}
      </ul>
    </section>
  );
}

function DeltaItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="text-[color:var(--color-brand-strong)]">{icon}</span>
      <span className="font-display tabular text-2xl text-[color:var(--color-ink)] md:text-3xl">
        {value}
      </span>
      <span className="text-sm text-[color:var(--color-ink)]">{label}</span>
    </li>
  );
}
