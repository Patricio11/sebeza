"use client";

/**
 * Phase 9.8.4  Client island for the match-page bulk-invite flow.
 *
 * Server-rendered `<TalentRosterItem>` rows are passed through `items`
 * as React nodes  the island never re-renders the row markup, only
 * the checkbox + selection state + sticky action bar + confirmation
 * modal. Keeps the existing Phase 5 redaction (the row's structure)
 * 100% server-rendered while the interactive shell is the only client
 * code that ships.
 *
 * Mobile-first: the confirmation modal renders as a bottom-sheet on
 * phones (anchored to the screen bottom, full-width, generous tap
 * targets) and as a centred modal on `md+`.
 *
 * Viewer role: caller passes `canInvite=false`; the island renders
 * the rows without checkboxes or the bulk bar  Viewers can still
 * browse the redacted talent pool, they just can't initiate invites.
 */

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

import { bulkInviteToVacancy } from "@/lib/employer/invitations";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Send, X } from "lucide-react";

export interface BulkInviteItem {
  profileId: string;
  handle: string;
  displayName: string;
  /** True iff this profile is already on this vacancy's invitation
   *  list (any state). The row stays visible but the checkbox is
   *  disabled + the row carries a soft "Already invited" pill. */
  alreadyInvited: boolean;
  /** The pre-rendered server component output (TalentRosterItem +
   *  the per-row CTAs). Passed as a node so the redaction surface
   *  stays server-rendered. */
  row: ReactNode;
}

export interface BulkInviteIslandProps {
  vacancyId: string;
  vacancyTitle: string;
  canInvite: boolean;
  items: BulkInviteItem[];
}

interface ResultBanner {
  invited: number;
  skipped: number;
}

export function BulkInviteIsland({
  vacancyId,
  vacancyTitle,
  canInvite,
  items,
}: BulkInviteIslandProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<ResultBanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(profileId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function selectAll() {
    setSelected(
      new Set(
        items.filter((i) => !i.alreadyInvited).map((i) => i.profileId),
      ),
    );
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function onConfirm() {
    setError(null);
    const profileIds = Array.from(selected);
    if (profileIds.length === 0) {
      setModalOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await bulkInviteToVacancy({ vacancyId, profileIds });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setBanner({ invited: res.invited, skipped: res.skipped });
      setSelected(new Set());
      setModalOpen(false);
      router.refresh();
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="relative">
      {/* Soft summary banner  appears after a successful bulk-invite.
          Per D5: shows counts only, never per-seeker reason. */}
      {banner && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex flex-wrap items-start gap-3 rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-4"
        >
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div className="flex-1 text-sm">
            <p className="font-display text-base text-[color:var(--color-ink)]">
              {banner.invited === 0
                ? `No invites sent  ${banner.skipped} not eligible to receive an invite right now.`
                : `${banner.invited} invite${banner.invited === 1 ? "" : "s"} sent${banner.skipped > 0 ? ` · ${banner.skipped} not eligible to receive an invite right now` : ""}.`}
            </p>
            {banner.skipped > 0 && (
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                We don&rsquo;t show per-person reasons here  it would leak
                consent state. The full picture lives in the org&rsquo;s audit
                log for admin oversight.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            aria-label="Dismiss"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Select-all toggle (top of list)  only when at least one
          unselected, not-already-invited row exists. */}
      {canInvite &&
        items.some((i) => !i.alreadyInvited) && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-ink-soft)]">
            <span>
              {selectedCount === 0
                ? `${items.filter((i) => !i.alreadyInvited).length} candidate${items.filter((i) => !i.alreadyInvited).length === 1 ? "" : "s"} eligible to invite`
                : `${selectedCount} selected of ${items.filter((i) => !i.alreadyInvited).length} eligible`}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
              >
                Select all
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

      <ol className="border-t border-[color:var(--color-hairline)]">
        {items.map((it) => {
          const isSelected = selected.has(it.profileId);
          return (
            <li key={it.profileId} className="relative">
              {canInvite && (
                <div className="absolute left-3 top-5 z-[1] md:top-7">
                  {it.alreadyInvited ? (
                    <span
                      className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
                      title="Already on the invitation list for this vacancy"
                    >
                      Invited
                    </span>
                  ) : (
                    // Row-select pattern  no visible label (the row text
                    // beside this is the implicit label). Deliberately uses
                    // a bare <input> instead of <Checkbox> because the
                    // outer 44px tap-target wrapper IS the click surface,
                    // and a visible label would duplicate the row name.
                    // aria-label provides screen-reader text.
                    <label className="flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] hover:bg-[color:var(--color-surface)]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(it.profileId)}
                        disabled={pending}
                        aria-label={`Select ${it.displayName} for bulk invite`}
                        className="size-5 cursor-pointer accent-[color:var(--color-ink)]"
                      />
                    </label>
                  )}
                </div>
              )}
              <div className={canInvite ? "pl-14 md:pl-16" : ""}>
                {it.row}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Sticky bulk-action bar  visible when ≥1 selected, hidden in
          Viewer mode (which never sees checkboxes). Bottom-anchored on
          all viewports because the candidate list is long; thumb-
          reachable on phones. */}
      {canInvite && selectedCount > 0 && (
        <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-4 shadow-lg">
          <div className="text-sm">
            <span className="font-display text-base text-[color:var(--color-ink)]">
              {selectedCount} selected
            </span>
            <span className="ml-2 text-[color:var(--color-ink-soft)]">
              for &ldquo;{vacancyTitle}&rdquo;
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={clearSelection}
              disabled={pending}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setError(null);
                setModalOpen(true);
              }}
              disabled={pending}
            >
              <Send className="size-4" aria-hidden="true" />
              Invite to opportunity
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation modal  bottom-sheet on mobile, centred on md+.
          Backdrop click + Esc close. */}
      {modalOpen && (
        <BulkInviteModal
          vacancyTitle={vacancyTitle}
          selectedCount={selectedCount}
          error={error}
          pending={pending}
          onCancel={() => setModalOpen(false)}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
}

interface ModalProps {
  vacancyTitle: string;
  selectedCount: number;
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function BulkInviteModal({
  vacancyTitle,
  selectedCount,
  error,
  pending,
  onCancel,
  onConfirm,
}: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-invite-h"
      className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5 shadow-xl md:rounded-[var(--radius-md)] md:p-7">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3
            id="bulk-invite-h"
            className="font-display text-xl text-[color:var(--color-ink)]"
          >
            Invite {selectedCount} {selectedCount === 1 ? "person" : "people"} to this opportunity?
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Close"
            className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Each person will get a notification: <em>&ldquo;{vacancyTitle}.&rdquo;</em>
          They can accept, decline, or decline with a reason  declining is
          free and never affects their visibility in search.
        </p>

        <ul className="mt-4 space-y-1.5 text-xs text-[color:var(--color-ink-soft)]">
          <li> Anyone without vacancy-invite consent is skipped silently  per-person reasons stay in the audit log.</li>
          <li> Already-invited candidates are skipped (no duplicates).</li>
          <li> Audit-logged as <code>vacancy.invite</code> for each invite sent.</li>
        </ul>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Sending" : `Send ${selectedCount} invite${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
