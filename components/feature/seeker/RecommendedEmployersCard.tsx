/**
 * Phase 11.4.5  recommended employers card on /dashboard/grow.
 *
 * Server component. Lists the top employers hiring in the seeker's
 * profession + province, ranked by confirmed-placement count + k=10
 * floor (suppression posture mirrors gov surfaces). Each row carries
 * a Follow button (Phase 11.4.2) so the seeker can capture warm
 * intent without leaving the page.
 *
 * Silent when no orgs clear the suppression floor  the page's other
 * sections fill the space. No "nothing here" empty state.
 */

import type { EmployerLeaderboardRow } from "@/db/queries/employer-leaderboard";
import { FollowEmployerButton } from "./FollowEmployerButton";
import { EmployerVerificationChip } from "@/components/feature/seeker/invitations/EmployerVerificationChip";
import { Building2, Sparkles } from "lucide-react";

interface Props {
  rows: EmployerLeaderboardRow[];
  /** Seeker's profession label  used in the eyebrow + the empty-
   *  state copy. */
  profession: string;
  province: string;
  /** Map of org-id -> already-following. The Follow button stays
   *  pre-filled when the seeker has already followed. */
  followed: Set<string>;
}

export function RecommendedEmployersCard({
  rows,
  profession,
  province,
  followed,
}: Props) {
  if (rows.length === 0) return null;
  return (
    <section
      aria-labelledby="rec-employers-h"
      className="mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-6"
    >
      <header className="mb-4 flex items-baseline justify-between border-b border-[color:var(--color-hairline)] pb-2">
        <div className="inline-flex items-center gap-2">
          <Sparkles
            className="size-4 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <h3 id="rec-employers-h" className="font-display text-lg">
            Employers hiring {profession}s in {province}
          </h3>
        </div>
        <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Ranked by confirmed hires
        </span>
      </header>

      <ul className="divide-y divide-[color:var(--color-hairline)]">
        {rows.map((r) => (
          <li
            key={r.orgId}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3"
          >
            <Building2
              className="size-5 shrink-0 text-[color:var(--color-ink-soft)]"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-base text-[color:var(--color-ink)]">
                  {r.orgName}
                </span>
                <EmployerVerificationChip state={r.orgVerification} />
              </div>
              <div className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                {r.confirmedPlacements} confirmed hire
                {r.confirmedPlacements === 1 ? "" : "s"} in your pool ·{" "}
                {r.openVacancyCount} open vacanc
                {r.openVacancyCount === 1 ? "y" : "ies"}
              </div>
            </div>
            <FollowEmployerButton
              orgId={r.orgId}
              initialFollowing={followed.has(r.orgId)}
              variant="icon"
            />
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        Sebenza never accepts paid placement on this list  ranking is
        confirmed-hire count only, with a suppression floor on
        low-volume employers. Follow an employer to get a quiet bell
        when they open a role you could fit.
      </p>
    </section>
  );
}
