"use client";

/**
 * Phase 13.8  per-row "Invite to vacancy" button for the employer view
 * of `/search`.
 *
 * Closes the inverse direction of the existing match-page flow:
 *   match page = pick a VACANCY  see matching candidates  bulk-invite
 *   search row = pick a CANDIDATE  see my open vacancies  single-invite
 *
 * Gating contract (matches the parent server page's load logic; this
 * island only renders when the server already decided to render it):
 *
 *   - Logged-out viewer    → button absent (server doesn't pass the slot)
 *   - Seeker viewer        → button absent
 *   - Employer, unverified → button absent (hide-not-disable per
 *                            "Verification-Honesty Rule": never advertise
 *                            an action the viewer can't take)
 *   - Employer, verified, with at least one open vacancy → modal opens
 *     to a vacancy picker (or single-vacancy confirmation if there's
 *     exactly one).
 *   - Employer, verified, ZERO open vacancies → modal still opens, but
 *     degrades to a "Create a vacancy first" CTA pointing at
 *     /employer/vacancies/new.
 *
 * UX:
 *   - Desktop (sm+): button only shows on row hover via the parent
 *     `<article className="group">` selector  keeps the result list
 *     clean for casual browsing.
 *   - Mobile (<sm): button is always visible (no hover concept on
 *     touch), stacked under "View profile" via the parent's flex-col
 *     pattern.
 *   - Modal: bottom-sheet on phones (items-end) / centred on md+
 *     (items-center)  mirrors `BulkInviteModal` from
 *     `BulkInviteIsland.tsx` (Phase 9.8.4).
 *
 * Dedup: vacancies already carrying an active invitation for the
 * target profile render disabled with "Already invited" hint. The
 * DB unique constraint on (vacancy_id, profile_id) is the safety
 * net; the action layer would refuse the duplicate, but the disabled
 * state stops the employer from clicking it in the first place.
 *
 * Consent / verification gates already enforced by
 * `bulkInviteToVacancy`  the action returns the "skipped" count and
 * we surface it as a single-profile soft message ("This seeker is not
 * accepting vacancy invites right now").
 */

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { bulkInviteToVacancy } from "@/lib/employer/invitations";
import { useLocale } from "next-intl";

export type InviteFromSearchVacancy = {
  id: string;
  title: string;
};

interface Props {
  profileId: string;
  profileDisplayName: string;
  vacancies: InviteFromSearchVacancy[];
  /** IDs of vacancies this profile is already on the active pipeline for. */
  alreadyInvitedVacancyIds: string[];
}

export function InviteFromSearchButton({
  profileId,
  profileDisplayName,
  vacancies,
  alreadyInvitedVacancyIds,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Desktop: invisible until row hover (the parent <article> sets
        // group). Mobile: always visible since there's no hover.
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-surface)] transition-opacity hover:opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      >
        <UserPlus className="size-3.5" aria-hidden="true" />
        Invite
        <span className="sr-only">  {profileDisplayName}</span>
      </button>
      {open && (
        <InviteDialog
          profileId={profileId}
          profileDisplayName={profileDisplayName}
          vacancies={vacancies}
          alreadyInvitedVacancyIds={new Set(alreadyInvitedVacancyIds)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InviteDialog({
  profileId,
  profileDisplayName,
  vacancies,
  alreadyInvitedVacancyIds,
  onClose,
}: {
  profileId: string;
  profileDisplayName: string;
  vacancies: InviteFromSearchVacancy[];
  alreadyInvitedVacancyIds: Set<string>;
  onClose: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const titleId = useId();
  const noteId = useId();
  const groupId = useId();

  // Pick the first vacancy that the profile is NOT already on. If
  // every open vacancy already has them, leave selected empty and the
  // submit button stays disabled.
  const firstPickable = vacancies.find(
    (v) => !alreadyInvitedVacancyIds.has(v.id),
  );
  const [selectedId, setSelectedId] = useState<string>(firstPickable?.id ?? "");
  const [personalNote, setPersonalNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    vacancyTitle: string;
    skipped: number;
  } | null>(null);

  function handleSubmit() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkInviteToVacancy({
        vacancyId: selectedId,
        profileIds: [profileId],
        personalNote: personalNote.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message ?? "Could not send invitation.");
        return;
      }
      const vacancy = vacancies.find((v) => v.id === selectedId);
      setSuccess({
        vacancyTitle: vacancy?.title ?? "vacancy",
        skipped: res.skipped,
      });
      // Refresh the search list so the next render reflects the new
      // active invitation (the button would otherwise still allow a
      // re-click against the same vacancy until the next nav).
      router.refresh();
    });
  }

  const hasOpen = vacancies.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // Bottom-sheet on mobile, centred on md+. Matches the BulkInviteModal
      // idiom from Phase 9.8.4 verbatim.
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] p-6 shadow-xl md:rounded-[var(--radius-lg)]">
        <header className="mb-4 border-b border-[color:var(--color-hairline)] pb-3">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Invite to vacancy
          </p>
          <h2
            id={titleId}
            className="font-display text-xl text-[color:var(--color-ink)]"
          >
            Send {profileDisplayName} an invitation
          </h2>
        </header>

        {success ? (
          <SuccessState
            vacancyTitle={success.vacancyTitle}
            displayName={profileDisplayName}
            skipped={success.skipped}
            onClose={onClose}
            locale={locale}
          />
        ) : !hasOpen ? (
          <NoVacancyState locale={locale} onClose={onClose} />
        ) : (
          <fieldset className="grid gap-4" disabled={pending}>
            <div>
              <p
                id={groupId}
                className="mb-2 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
              >
                Pick a vacancy ({vacancies.length} open)
              </p>
              <ul
                role="radiogroup"
                aria-labelledby={groupId}
                className="grid max-h-64 gap-2 overflow-y-auto"
              >
                {vacancies.map((v) => {
                  const alreadyInvited = alreadyInvitedVacancyIds.has(v.id);
                  const isSelected = selectedId === v.id;
                  return (
                    <li key={v.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors ${
                          alreadyInvited
                            ? "cursor-not-allowed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] opacity-60"
                            : isSelected
                              ? "border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)]"
                              : "border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="invite-vacancy"
                          value={v.id}
                          checked={isSelected}
                          disabled={alreadyInvited || pending}
                          onChange={() => setSelectedId(v.id)}
                          className="size-4"
                        />
                        <span className="flex-1 truncate">{v.title}</span>
                        {alreadyInvited && (
                          <span className="text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
                            Already invited
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <label className="grid gap-1">
              <span
                id={noteId}
                className="text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
              >
                Personal note (optional)
              </span>
              <textarea
                aria-labelledby={noteId}
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Hi  saw your profile and the role looks like a strong match."
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
              />
              <span className="text-[0.7rem] text-[color:var(--color-ink-soft)]">
                {personalNote.length} / 200 chars. POPIA s.16: keep this
                respectful and role-relevant.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`/${locale}/employer/vacancies/new`}
                className="text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)] underline-offset-2 hover:text-[color:var(--color-ink)] hover:underline"
              >
                Or create a new vacancy
              </a>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-3 py-2 text-xs text-[color:var(--color-ink)]"
              >
                {error}
              </p>
            )}

            <footer className="mt-1 flex justify-end gap-2 border-t border-[color:var(--color-hairline)] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-1.5 text-sm text-[color:var(--color-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !selectedId}
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                )}
                Send invitation
              </button>
            </footer>
          </fieldset>
        )}
      </div>
    </div>
  );
}

function NoVacancyState({
  locale,
  onClose,
}: {
  locale: string;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        You don&rsquo;t have any open vacancies yet. Create one and
        you&rsquo;ll be able to invite candidates directly from search
        results.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-1.5 text-sm text-[color:var(--color-ink-soft)]"
        >
          Not now
        </button>
        <a
          href={`/${locale}/employer/vacancies/new`}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-surface)]"
        >
          Create a vacancy
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function SuccessState({
  vacancyTitle,
  displayName,
  skipped,
  onClose,
  locale,
}: {
  vacancyTitle: string;
  displayName: string;
  skipped: number;
  onClose: () => void;
  locale: string;
}) {
  return (
    <div className="grid gap-4">
      {skipped > 0 ? (
        // The bulk action surfaces a skipped count when consent or
        // dedup blocks the send. Single-profile invocation = either 1
        // sent + 0 skipped (success) or 0 sent + 1 skipped (gated).
        // We surface the gated state honestly so the employer doesn't
        // think the invite went through.
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-4 text-sm">
          <p className="font-medium">
            {displayName} can&rsquo;t receive this invite right now.
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            They may not have opted in to vacancy invites, or
            they&rsquo;re already on this vacancy. Nothing was sent.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-positive)]/40 bg-[color:var(--color-positive)]/10 p-4 text-sm">
          <CheckCircle2
            className="mt-0.5 size-4 text-[color:var(--color-positive)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">
              Invitation sent to {displayName}.
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              Tracked on the vacancy&rsquo;s pipeline panel under{" "}
              <em>{vacancyTitle}</em>. They&rsquo;ll receive an in-app
              notification.
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-[color:var(--color-hairline)] pt-4">
        <a
          href={`/${locale}/employer/vacancies`}
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-1.5 text-sm text-[color:var(--color-ink-soft)]"
        >
          View vacancies
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-surface)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
