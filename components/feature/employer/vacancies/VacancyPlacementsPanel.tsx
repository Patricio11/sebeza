/**
 * Phase 9.8.6  Vacancy  Placement linkage panel.
 *
 * Server-rendered panel on the vacancy detail page. Three states:
 *
 *   1. **Filled, nothing logged yet**  prominent prompt to log the
 *      placement that filled this role. Surfaces accepted invitees as
 *      one-tap "Log this hire" CTAs that deep-link to the existing
 *      dossier mark-as-hired flow with `?vacancyId=...` (the dossier
 *      page reads it server-side + the MarkAsHiredCard banner
 *      confirms the link).
 *
 *   2. **Open / filled, ≥ 1 placement linked**  shows the linked
 *      placements (Placement-Truth visible to the whole org) AND keeps
 *      the "log another" affordance (cardinality 1 vacancy : 0..N
 *      placements per the plan  one posting can produce multiple
 *      hires).
 *
 *   3. **No accepted invitees, no placements**  hidden entirely.
 *      Nothing meaningful to surface yet.
 *
 * Mobile-first: cards stack on phones; the placement-log CTA on each
 * accepted invitee is a ≥ 44px tap target. The "Log a hire from
 * another source" fallback uses an inline note (not a separate
 * surface)  the dossier picker already lives at /employer/search.
 *
 * Read-only for Viewers (no "Log hire" CTAs); the Owner / Recruiter
 * permission lives at the parent page, this component receives
 * `canEdit` as a prop.
 */

import { Link } from "@/i18n/navigation";
import { Briefcase, CheckCircle2, Lock, Plus, Trophy } from "lucide-react";

import type { VacancyPlacementRow } from "@/lib/employer/placements";
import type { InvitationRow } from "@/lib/employer/invitations";

interface Props {
  vacancyId: string;
  vacancyStatus: "draft" | "open" | "closed" | "filled";
  /** Owner / Recruiter only. Viewers see the panel read-only. */
  canEdit: boolean;
  /** All placements already linked to this vacancy. */
  placements: VacancyPlacementRow[];
  /** All invitations on this vacancy. We filter to accepted /
   *  accepted-with-notice rows internally  the "log hire" CTAs make
   *  sense only for seekers who said yes. */
  invitations: InvitationRow[];
  locale: string;
}

const ACCEPTED_STATES = new Set(["accepted", "accepted_with_notice"]);

export function VacancyPlacementsPanel({
  vacancyId,
  vacancyStatus,
  canEdit,
  placements,
  invitations,
  locale,
}: Props) {
  const accepted = invitations.filter((i) => ACCEPTED_STATES.has(i.state));
  const placedProfileIds = new Set(placements.map((p) => p.profileId));
  const pendingAccepted = accepted.filter(
    (i) => !placedProfileIds.has(i.profileId),
  );

  // Hide the panel entirely when there's nothing to surface.
  if (placements.length === 0 && accepted.length === 0) return null;

  const dfmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const filledPrompt =
    vacancyStatus === "filled" && placements.length === 0 && canEdit;

  return (
    <section
      aria-labelledby="placements-h"
      className={
        "mb-6 rounded-[var(--radius-md)] p-5 md:p-6 " +
        (filledPrompt
          ? "border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
          : "border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]")
      }
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <div className="flex items-center gap-2">
          <Trophy
            className={
              "size-5 " +
              (filledPrompt
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--color-ink-soft)]")
            }
            aria-hidden="true"
          />
          <h2
            id="placements-h"
            className="font-display text-xl text-[color:var(--color-ink)]"
          >
            Placements · {placements.length} logged
          </h2>
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          Only <strong>employer-confirmed</strong> placements count toward
          national analytics (Placement-Truth Rule).
        </p>
      </header>

      {/* Filled-but-nothing-logged prompt  the loud nudge per the plan. */}
      {filledPrompt && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-paper)] p-3 text-sm">
          <p className="font-display text-base text-[color:var(--color-ink)]">
            This vacancy is marked <strong>filled</strong>  log the
            placement that closed it.
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            Pick the candidate you hired below. The dossier opens with
            this vacancy already linked  one tap to confirm.
          </p>
        </div>
      )}

      {/* Already-linked placements list  read-only for everyone (the
          Placement-Truth row is the audit; deletion lives on the
          /employer/placements page). */}
      {placements.length > 0 && (
        <ul className="mb-5 divide-y divide-[color:var(--color-hairline)]">
          {placements.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/employer/dossier/${p.handle}` as never}
                    className="font-display text-base text-[color:var(--color-ink)] hover:underline"
                  >
                    {p.displayName}
                  </Link>
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Hired
                  </span>
                  {p.source !== "employer_confirmed" && (
                    <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      {p.source}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {p.role}  {p.city}  hired{" "}
                  {dfmt.format(new Date(p.hiredAt))}
                  {p.salaryBand && (
                    <>
                      {" "}
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3" aria-hidden="true" />
                        salary band on file (private)
                      </span>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Accepted invitees not yet placed  per-row "Log this hire"
          CTA that deep-links to the dossier with vacancyId pre-armed.
          Owner / Recruiter only. */}
      {canEdit && pendingAccepted.length > 0 && (
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Accepted invitees  log a hire
          </p>
          <ul className="space-y-2">
            {pendingAccepted.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/employer/dossier/${inv.handle}` as never}
                    className="font-display text-sm text-[color:var(--color-ink)] hover:underline"
                  >
                    {inv.displayName}
                  </Link>
                  {inv.state === "accepted_with_notice" &&
                    inv.noticePeriodMonths != null && (
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                        Accepted with {inv.noticePeriodMonths}-month notice
                      </p>
                    )}
                </div>
                <Link
                  href={
                    `/employer/dossier/${inv.handle}?vacancyId=${vacancyId}#mark-as-hired` as never
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
                >
                  <Briefcase className="size-4" aria-hidden="true" />
                  Log this hire
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fallback note  the dossier flow stays the canonical entry
          point for hires logged from outside the invitation pipeline
          (the employer found the right person via /search and the
          invitee list was incidental). Inline guidance only  no new
          surface to maintain. */}
      {canEdit && (
        <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
          <Plus className="mr-1 inline size-3" aria-hidden="true" />
          Hired someone not on the accepted list? Open their dossier and
          use <em>Mark as hired</em>  pass{" "}
          <code>?vacancyId={vacancyId}</code> in the URL to link the
          placement to this vacancy.
        </p>
      )}
    </section>
  );
}
