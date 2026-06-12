"use client";

/**
 * Phase 9.8.4  Client island for the match-page bulk-invite flow.
 * Phase 9.19 Tier 2  client-side filter chips, sort dropdown, and
 * per-(org, vacancy) shortlist toggle, all layered on top of the same
 * selection / bulk-invite state.
 *
 * Server-rendered `<TalentRosterItem>` rows are passed through `items`
 * as React nodes  the island never re-renders the row markup, only
 * the checkbox + selection state + sticky action bar + confirmation
 * modal + (Phase 9.19) the filter / sort / view-toggle chrome and the
 * per-row bookmark button. Keeps the existing Phase 5 redaction (the
 * row's structure) 100% server-rendered while the interactive shell
 * is the only client code that ships.
 *
 * Mobile-first: the confirmation modal renders as a bottom-sheet on
 * phones (anchored to the screen bottom, full-width, generous tap
 * targets) and as a centred modal on `md+`. The chrome strip wraps
 * cleanly at 360px wide.
 *
 * Viewer role: caller passes `canInvite=false`; the island renders
 * the rows without checkboxes or the bulk bar  Viewers can still
 * browse the redacted talent pool, browse the shortlist view, change
 * sort / filter chips. They just can't initiate invites or toggle
 * shortlist membership.
 */

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

import { bulkInviteToVacancy } from "@/lib/employer/invitations";
import { Button } from "@/components/ui/Button";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Send,
  X,
} from "lucide-react";
import type { WorkAvailabilityKind } from "@/lib/mock/types";

/**
 * Phase 9.19 D4  the client-side filter chips refine the
 * SEARCH_LIMIT-capped already-fetched list. They do NOT re-run the
 * matcher with tighter filters. See the docs/PHASE_9_19_PLAN.md
 * decision text for why.
 */
const WORK_AVAILABILITY_CHIPS: ReadonlyArray<{
  value: WorkAvailabilityKind;
  label: string;
}> = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "casual", label: "Casual" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

const YEARS_QUICKPICKS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 5, label: "5+ yrs" },
  { value: 8, label: "8+ yrs" },
];

type SortKey = "best" | "freshest" | "complete" | "citizens";

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "best", label: "Best match" },
  { value: "freshest", label: "Most recent status" },
  { value: "complete", label: "Most complete profile" },
  { value: "citizens", label: "SA citizens first" },
];

type ViewMode = "all" | "shortlist";

export interface BulkInviteItem {
  profileId: string;
  handle: string;
  displayName: string;
  /** True iff this profile is already on this vacancy's invitation
   *  list (any state). The row stays visible but the checkbox is
   *  disabled + the row carries a soft "Already invited" pill. */
  alreadyInvited: boolean;
  /**
   * Phase 9.19  current shortlist membership for this (vacancy,
   * profile). Toggled optimistically client-side, then persisted via
   * the add/remove server actions. Stays in sync after the next
   * `router.refresh()`.
   */
  shortlisted: boolean;
  /**
   * Phase 9.19  the candidate metadata the client island reads to
   * apply chips + sort without re-rendering the server row. Doesn't
   * widen the public surface; mirrors fields already visible in the
   * `TalentRosterItem` output.
   */
  meta: {
    workAvailability: WorkAvailabilityKind[];
    yearsExperience: number | null;
    isCitizen: boolean;
    /** ISO timestamp  freshness sort key. */
    statusConfirmedAt: string;
    completeness: number;
  };
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
  /**
   * Phase 9.19 Tier 2  add/remove the (vacancy, profile) pair from
   * the shortlist. Server actions threaded through from the page so
   * the island stays decoupled from `lib/employer/vacancy-shortlists`.
   */
  addToShortlistAction: (
    profileId: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeFromShortlistAction: (
    profileId: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
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
  addToShortlistAction,
  removeFromShortlistAction,
}: BulkInviteIslandProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<ResultBanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phase 9.19 Tier 2  filter / sort / view state. All client-side
  // (D4): chips refine the already-fetched list, never re-run the
  // matcher. Sort is local re-ordering of the same set.
  const [availabilityFilter, setAvailabilityFilter] = useState<
    Set<WorkAvailabilityKind>
  >(new Set());
  const [yearsFilter, setYearsFilter] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("best");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  /** Local mirror of each item's shortlist state. Server actions write
   *  through `router.refresh()`, but we flip this optimistically so the
   *  UI is responsive on a 3G link  the spinner inside `pending`
   *  covers the round-trip. */
  const [shortlistOverrides, setShortlistOverrides] = useState<
    Map<string, boolean>
  >(new Map());
  const [shortlistPending, setShortlistPending] = useState<Set<string>>(
    new Set(),
  );

  /**
   * Phase 9.19 Tier 3 D6  optional 200-char personal note attached
   * to the next bulk-invite call. Lives in the modal's textarea; gets
   * cleared (along with selection) after a successful send.
   */
  const [personalNote, setPersonalNote] = useState<string>("");

  function isShortlisted(item: BulkInviteItem): boolean {
    return shortlistOverrides.get(item.profileId) ?? item.shortlisted;
  }

  // Phase 9.19  apply chip filters then sort. `displayItems` is what
  // the rest of the island renders against (eligibility counts, select-
  // all set, the rendered `<ol>`). Selection state survives filtering;
  // a row that gets filtered out stays selected so the user can flip
  // the chip back without losing their picks.
  const displayItems = useMemo(() => {
    const inShortlistView = viewMode === "shortlist";
    const filtered = items.filter((it) => {
      if (inShortlistView && !isShortlisted(it)) return false;
      if (availabilityFilter.size > 0) {
        const intersects = it.meta.workAvailability.some((k) =>
          availabilityFilter.has(k),
        );
        if (!intersects) return false;
      }
      if (yearsFilter !== null) {
        if (
          it.meta.yearsExperience === null ||
          it.meta.yearsExperience < yearsFilter
        ) {
          return false;
        }
      }
      return true;
    });
    if (sortKey === "best") return filtered;
    const sorted = [...filtered];
    if (sortKey === "freshest") {
      sorted.sort(
        (a, b) =>
          new Date(b.meta.statusConfirmedAt).valueOf() -
          new Date(a.meta.statusConfirmedAt).valueOf(),
      );
    } else if (sortKey === "complete") {
      sorted.sort((a, b) => b.meta.completeness - a.meta.completeness);
    } else if (sortKey === "citizens") {
      // Stable two-key sort: SA citizens first, then keep server order
      // (which already encodes the ranked score) within each bucket.
      const indexOf = new Map(items.map((it, idx) => [it.profileId, idx]));
      sorted.sort((a, b) => {
        if (a.meta.isCitizen !== b.meta.isCitizen) {
          return a.meta.isCitizen ? -1 : 1;
        }
        return (indexOf.get(a.profileId) ?? 0) - (indexOf.get(b.profileId) ?? 0);
      });
    }
    return sorted;
    // isShortlisted depends on shortlistOverrides; including the map in
    // the deps array re-computes on every toggle without going through
    // a stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    items,
    availabilityFilter,
    yearsFilter,
    sortKey,
    viewMode,
    shortlistOverrides,
  ]);

  const shortlistCount = items.filter(isShortlisted).length;
  const eligibleDisplayed = displayItems.filter(
    (i) => !i.alreadyInvited,
  ).length;

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
        displayItems
          .filter((i) => !i.alreadyInvited)
          .map((i) => i.profileId),
      ),
    );
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function toggleAvailability(kind: WorkAvailabilityKind) {
    setAvailabilityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }
  function clearAllFilters() {
    setAvailabilityFilter(new Set());
    setYearsFilter(null);
  }

  function toggleShortlist(item: BulkInviteItem) {
    if (!canInvite) return;
    const current = isShortlisted(item);
    setShortlistOverrides((prev) => {
      const next = new Map(prev);
      next.set(item.profileId, !current);
      return next;
    });
    setShortlistPending((prev) => {
      const next = new Set(prev);
      next.add(item.profileId);
      return next;
    });
    startTransition(async () => {
      const res = current
        ? await removeFromShortlistAction(item.profileId)
        : await addToShortlistAction(item.profileId);
      setShortlistPending((prev) => {
        const next = new Set(prev);
        next.delete(item.profileId);
        return next;
      });
      if (!res.ok) {
        // Roll back the optimistic flip + surface the message.
        setShortlistOverrides((prev) => {
          const next = new Map(prev);
          next.set(item.profileId, current);
          return next;
        });
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onConfirm() {
    setError(null);
    const profileIds = Array.from(selected);
    if (profileIds.length === 0) {
      setModalOpen(false);
      return;
    }
    const note = personalNote.trim();
    startTransition(async () => {
      const res = await bulkInviteToVacancy({
        vacancyId,
        profileIds,
        ...(note.length > 0 ? { personalNote: note } : {}),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setBanner({ invited: res.invited, skipped: res.skipped });
      setSelected(new Set());
      setPersonalNote("");
      setModalOpen(false);
      router.refresh();
    });
  }

  const selectedCount = selected.size;
  const filtersActive = availabilityFilter.size > 0 || yearsFilter !== null;

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

      {/* Phase 9.19 Tier 2  view toggle (All / Shortlist), filter chips
          (work mode + years quick-pick), sort dropdown. Wraps cleanly
          at 360px. The toolbar lives above the select-all strip so the
          filter/sort feels like list-shaping and the select feels like
          list-action. */}
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Candidate view"
            className="inline-flex rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-0.5 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "all"}
              onClick={() => setViewMode("all")}
              className={
                "rounded-[var(--radius-pill)] px-3 py-1.5 transition-colors " +
                (viewMode === "all"
                  ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                  : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
              }
            >
              All matches ({items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "shortlist"}
              onClick={() => setViewMode("shortlist")}
              className={
                "rounded-[var(--radius-pill)] px-3 py-1.5 transition-colors " +
                (viewMode === "shortlist"
                  ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                  : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
              }
            >
              Shortlist ({shortlistCount})
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-ink)]"
              aria-label="Sort candidates"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Chip strip. "All" clears every chip filter; the rest are
            independent toggles. The strip is wrap-friendly on a 360px
            viewport. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearAllFilters}
            aria-pressed={!filtersActive}
            className={
              "rounded-[var(--radius-pill)] border px-3 py-1 text-xs transition-colors " +
              (!filtersActive
                ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]")
            }
          >
            All
          </button>
          {WORK_AVAILABILITY_CHIPS.map((chip) => {
            const on = availabilityFilter.has(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => toggleAvailability(chip.value)}
                aria-pressed={on}
                className={
                  "rounded-[var(--radius-pill)] border px-3 py-1 text-xs transition-colors " +
                  (on
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                }
              >
                {chip.label}
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="mx-1 h-4 w-px self-center bg-[color:var(--color-hairline)]"
          />
          {YEARS_QUICKPICKS.map((pick) => {
            const on = yearsFilter === pick.value;
            return (
              <button
                key={pick.value}
                type="button"
                onClick={() => setYearsFilter(on ? null : pick.value)}
                aria-pressed={on}
                className={
                  "rounded-[var(--radius-pill)] border px-3 py-1 text-xs transition-colors " +
                  (on
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                }
              >
                {pick.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Select-all toggle (top of list)  only when at least one
          unselected, not-already-invited row exists in the current
          (post-filter) view. */}
      {canInvite && eligibleDisplayed > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-ink-soft)]">
            <span>
              {selectedCount === 0
                ? `${eligibleDisplayed} candidate${eligibleDisplayed === 1 ? "" : "s"} eligible to invite`
                : `${selectedCount} selected of ${eligibleDisplayed} eligible`}
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

      {/* Empty-state for filtered view  preserves selection state so
          flipping the chip off restores everything. */}
      {displayItems.length === 0 && items.length > 0 && (
        <div className="mb-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-6 text-center text-sm text-[color:var(--color-ink-soft)]">
          {viewMode === "shortlist" ? (
            <>
              <strong>No one on the shortlist yet.</strong> Tap the
              bookmark icon beside any candidate to save them here.
            </>
          ) : (
            <>
              <strong>No candidates match these filters.</strong>{" "}
              <button
                type="button"
                onClick={clearAllFilters}
                className="underline underline-offset-2 hover:text-[color:var(--color-ink)]"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}

      <ol className="border-t border-[color:var(--color-hairline)]">
        {displayItems.map((it) => {
          const isSelected = selected.has(it.profileId);
          const shortlisted = isShortlisted(it);
          const shortlistBusy = shortlistPending.has(it.profileId);
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
              {/* Phase 9.19 Tier 2  per-row shortlist toggle. Only
                  rendered when the caller can edit the vacancy; Viewers
                  see the rows but can't change shortlist membership. */}
              {canInvite && (
                <div className="absolute right-3 top-5 z-[1] md:top-7">
                  <button
                    type="button"
                    onClick={() => toggleShortlist(it)}
                    disabled={shortlistBusy}
                    aria-pressed={shortlisted}
                    aria-label={
                      shortlisted
                        ? `Remove ${it.displayName} from shortlist`
                        : `Save ${it.displayName} to shortlist`
                    }
                    title={
                      shortlisted ? "Remove from shortlist" : "Save to shortlist"
                    }
                    className={
                      "flex size-11 items-center justify-center rounded-[var(--radius-sm)] transition-colors disabled:opacity-50 " +
                      (shortlisted
                        ? "text-[color:var(--color-brand-strong)] hover:bg-[color:var(--color-brand-tint)]"
                        : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-ink)]")
                    }
                  >
                    {shortlisted ? (
                      <BookmarkCheck className="size-5" aria-hidden="true" />
                    ) : (
                      <Bookmark className="size-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
              <div className={canInvite ? "pl-14 pr-14 md:pl-16 md:pr-16" : ""}>
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
          personalNote={personalNote}
          onPersonalNoteChange={setPersonalNote}
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
  personalNote: string;
  onPersonalNoteChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const PERSONAL_NOTE_MAX = 200;

function BulkInviteModal({
  vacancyTitle,
  selectedCount,
  error,
  pending,
  personalNote,
  onPersonalNoteChange,
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
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onCancel();
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

        {/* Phase 9.19 D6  optional personal note. Same 200-char cap +
            PII-flag pattern as the Phase 9.17 seeker-invite note. The
            note is the SAME across every invite in this batch (the modal
            is the batch boundary); per-seeker personalisation belongs in
            the dossier-DM flow that lands later. */}
        <div className="mt-5">
          <label
            htmlFor="bulk-invite-note"
            className="flex items-baseline justify-between text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
          >
            <span>
              Add a note
              <span className="ml-1 text-[color:var(--color-ink-soft)]">
                (optional)
              </span>
            </span>
            <span
              className={
                "text-[0.65rem] tracking-normal " +
                (personalNote.length > PERSONAL_NOTE_MAX
                  ? "text-[color:var(--color-danger)]"
                  : "text-[color:var(--color-ink-soft)]")
              }
              aria-live="polite"
            >
              {personalNote.length} / {PERSONAL_NOTE_MAX}
            </span>
          </label>
          <textarea
            id="bulk-invite-note"
            value={personalNote}
            onChange={(e) => onPersonalNoteChange(e.target.value)}
            disabled={pending}
            maxLength={PERSONAL_NOTE_MAX}
            rows={3}
            placeholder="Why you're reaching out  what about their profile caught your eye."
            className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-sm text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]"
          />
          <p className="mt-1.5 text-xs text-[color:var(--color-ink-soft)]">
            The same note attaches to every invite in this batch. Logged
            as PII alongside the audit row  if you'd rather not write
            anything, leave it blank.
          </p>
        </div>

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
