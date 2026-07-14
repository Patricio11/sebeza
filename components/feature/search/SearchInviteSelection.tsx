"use client";

/**
 * Phase 29.4  the seamless /search invite funnel.
 *
 * Anyone browsing the PUBLIC search can tick candidates; the moment they
 * act on the selection they're routed through the right gate:
 *
 *   logged-out            → "Sign in to invite" → /sign-in?next=<here>
 *                            (selection lives in localStorage, so it
 *                            survives the auth round-trip; `?invite=1`
 *                            re-opens this dialog on return)
 *   employer, verified    → vacancy picker → consent-gated bulk send
 *                            (server resolves handles → ids inside the
 *                            verified boundary  Redaction Rule holds)
 *   employer, unverified  → honest gate: verify the organisation first
 *                            (selection stays saved)
 *   seeker / gov / admin  → the server page never renders this island
 *                            (hide-not-disable: the action can never
 *                            apply to them)
 *
 * The selection stores ONLY public identifiers (handle + display name
 * exactly what the public result row already shows). Capped at 50 to
 * match the bulk-invite server cap.
 *
 * No-Flash: one island, no portal, no animation library; the bar and
 * dialog are plain DOM with transform/opacity transitions.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useId,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  LogIn,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { bulkInviteByHandles } from "@/lib/employer/invitations";
import { routing } from "@/i18n/routing";
import type { InviteFromSearchVacancy } from "@/components/feature/employer/vacancies/InviteFromSearchButton";

export type SearchInviteViewer =
  | "logged_out"
  | "employer_verified"
  | "employer_unverified";

interface SelectedCandidate {
  handle: string;
  displayName: string;
}

const STORAGE_KEY = "sebenza:search-invite-selection:v1";
const SELECTION_CAP = 50;

function readStoredSelection(): SelectedCandidate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is SelectedCandidate =>
          !!e &&
          typeof e === "object" &&
          typeof (e as SelectedCandidate).handle === "string" &&
          typeof (e as SelectedCandidate).displayName === "string",
      )
      .slice(0, SELECTION_CAP);
  } catch {
    return [];
  }
}

interface Ctx {
  viewer: SearchInviteViewer;
  selection: SelectedCandidate[];
  isSelected: (handle: string) => boolean;
  toggle: (candidate: SelectedCandidate) => void;
  clear: () => void;
  atCap: boolean;
}

const SelectionContext = createContext<Ctx | null>(null);

export function SearchInviteProvider({
  viewer,
  vacancies,
  children,
}: {
  viewer: SearchInviteViewer;
  /** Open vacancies for the picker  only populated for verified employers. */
  vacancies: InviteFromSearchVacancy[];
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<SelectedCandidate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Hydrate from localStorage AFTER mount (SSR renders an empty
  // selection; restoring in an effect avoids a hydration mismatch).
  useEffect(() => {
    setSelection(readStoredSelection());
    setHydrated(true);
  }, []);

  // Persist every change (post-hydration only, so the initial empty
  // state never clobbers a stored selection).
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (selection.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
      }
    } catch {
      // Storage unavailable (private mode)  selection still works for
      // the current page; it just won't survive the auth round-trip.
    }
  }, [selection, hydrated]);

  // `?invite=1` (the post-sign-in / post-create-vacancy return leg) →
  // re-open the dialog once the stored selection is back.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite") === "1" && readStoredSelection().length > 0) {
      setDialogOpen(true);
    }
  }, [hydrated]);

  const isSelected = useCallback(
    (handle: string) => selection.some((c) => c.handle === handle),
    [selection],
  );
  const toggle = useCallback((candidate: SelectedCandidate) => {
    setSelection((prev) => {
      const exists = prev.some((c) => c.handle === candidate.handle);
      if (exists) return prev.filter((c) => c.handle !== candidate.handle);
      if (prev.length >= SELECTION_CAP) return prev;
      return [...prev, candidate];
    });
  }, []);
  const clear = useCallback(() => setSelection([]), []);

  const ctx = useMemo<Ctx>(
    () => ({
      viewer,
      selection,
      isSelected,
      toggle,
      clear,
      atCap: selection.length >= SELECTION_CAP,
    }),
    [viewer, selection, isSelected, toggle, clear],
  );

  return (
    <SelectionContext.Provider value={ctx}>
      {children}
      <SelectionBar onInvite={() => setDialogOpen(true)} />
      {dialogOpen && (
        <InviteSelectionDialog
          viewer={viewer}
          vacancies={vacancies}
          selection={selection}
          onClear={clear}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </SelectionContext.Provider>
  );
}

function useSelection(): Ctx {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error(
      "SearchInviteSelection components must render inside SearchInviteProvider.",
    );
  }
  return ctx;
}

/** Per-row checkbox (leading slot on TalentRosterItem). */
export function SelectCandidateCheckbox({
  handle,
  displayName,
}: SelectedCandidate) {
  const { isSelected, toggle, atCap } = useSelection();
  const selected = isSelected(handle);
  return (
    <input
      type="checkbox"
      checked={selected}
      disabled={!selected && atCap}
      onChange={() => toggle({ handle, displayName })}
      aria-label={`Select ${displayName} to invite`}
      className="size-5 cursor-pointer accent-[color:var(--color-brand)] disabled:cursor-not-allowed"
    />
  );
}

/** Floating action bar  appears the moment something is selected. */
function SelectionBar({ onInvite }: { onInvite: () => void }) {
  const { selection, clear, atCap } = useSelection();
  if (selection.length === 0) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 print:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]/95 py-2 pl-5 pr-2 shadow-[0_10px_30px_rgba(20,17,13,0.18),0_2px_6px_rgba(20,17,13,0.08)] backdrop-blur-md"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--color-ink)]">
          <span className="font-display">{selection.length}</span> candidate
          {selection.length === 1 ? "" : "s"} selected
          {atCap && (
            <span className="ml-1 text-xs text-[color:var(--color-ink-soft)]">
              (max {SELECTION_CAP})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded-[var(--radius-pill)] px-2 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onInvite}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)] transition-transform active:scale-95"
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          Invite
        </button>
      </div>
    </div>
  );
}

/** Current URL with `invite=1` appended  the return leg for both the
 *  sign-in and the create-vacancy detours. LOCALE-STRIPPED, because both
 *  consumers (SignInForm and VacancyForm) push the destination through
 *  the i18n router, which re-adds the locale prefix. Client-only (the
 *  dialog never renders during SSR). */
function hereWithInviteFlag(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("invite", "1");
  let path = url.pathname;
  const firstSegment = path.split("/")[1] ?? "";
  if ((routing.locales as readonly string[]).includes(firstSegment)) {
    path = path.slice(firstSegment.length + 1) || "/";
  }
  return path + url.search;
}

function InviteSelectionDialog({
  viewer,
  vacancies,
  selection,
  onClear,
  onClose,
}: {
  viewer: SearchInviteViewer;
  vacancies: InviteFromSearchVacancy[];
  selection: SelectedCandidate[];
  onClear: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const preview =
    selection
      .slice(0, 3)
      .map((c) => c.displayName)
      .join(", ") +
    (selection.length > 3 ? ` and ${selection.length - 3} more` : "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 outline-none md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] p-6 shadow-xl md:rounded-[var(--radius-lg)]">
        <header className="mb-4 border-b border-[color:var(--color-hairline)] pb-3">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Invite to vacancy
          </p>
          <h2
            id={titleId}
            className="font-display text-xl text-[color:var(--color-ink)]"
          >
            {selection.length} candidate{selection.length === 1 ? "" : "s"}{" "}
            selected
          </h2>
          <p className="mt-1 truncate text-xs text-[color:var(--color-ink-soft)]">
            {preview}
          </p>
        </header>

        {viewer === "logged_out" ? (
          <SignInGate onClose={onClose} />
        ) : viewer === "employer_unverified" ? (
          <VerificationGate onClose={onClose} />
        ) : (
          <VacancyPickerBody
            vacancies={vacancies}
            selection={selection}
            onClear={onClear}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

/** Logged-out leg: the selection is already saved; sign in and return. */
function SignInGate({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  return (
    <div className="grid gap-4">
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        Sign in to your employer account to send these invitations. Your
        selection is saved on this device &mdash; you&rsquo;ll come
        straight back here to finish.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-1.5 text-sm text-[color:var(--color-ink-soft)]"
        >
          Keep browsing
        </button>
        <a
          href={`/${locale}/sign-in?next=${encodeURIComponent(hereWithInviteFlag())}`}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)]"
        >
          <LogIn className="size-3.5" aria-hidden="true" />
          Sign in to invite
        </a>
      </div>
      <p className="text-[0.7rem] text-[color:var(--color-ink-soft)]">
        New to Sebenza? Signing up as an employer takes a few minutes;
        invitations unlock once your organisation is verified.
      </p>
    </div>
  );
}

/** Unverified-org leg: honest gate, selection preserved. */
function VerificationGate({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 p-4 text-sm">
        <ShieldAlert
          className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">
            Your organisation isn&rsquo;t verified yet.
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            Contacting candidates is a POPIA-protected action, so it
            unlocks after verification. Your selection stays saved on
            this device &mdash; finish verification and come back.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-1.5 text-sm text-[color:var(--color-ink-soft)]"
        >
          Not now
        </button>
        <a
          href={`/${locale}/employer/onboarding`}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)]"
        >
          Verify my organisation
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/** Verified-employer leg: pick a vacancy (or create one), then send. */
function VacancyPickerBody({
  vacancies,
  selection,
  onClear,
  onClose,
}: {
  vacancies: InviteFromSearchVacancy[];
  selection: SelectedCandidate[];
  onClear: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const groupId = useId();
  const noteId = useId();
  const [selectedId, setSelectedId] = useState<string>(vacancies[0]?.id ?? "");
  const [personalNote, setPersonalNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    invited: number;
    skipped: number;
    vacancyTitle: string;
  } | null>(null);

  function handleSend() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkInviteByHandles({
        vacancyId: selectedId,
        handles: selection.map((c) => c.handle),
        personalNote: personalNote.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message ?? "Could not send invitations.");
        return;
      }
      setResult({
        invited: res.invited,
        skipped: res.skipped,
        vacancyTitle:
          vacancies.find((v) => v.id === selectedId)?.title ?? "vacancy",
      });
      // The funnel is complete  the selection has served its purpose.
      onClear();
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="grid gap-4">
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-positive)]/40 bg-[color:var(--color-positive)]/10 p-4 text-sm">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-[color:var(--color-positive)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">
              {result.invited === 0
                ? `No invites sent  ${result.skipped} candidate${result.skipped === 1 ? " isn't" : "s aren't"} eligible right now.`
                : `${result.invited} invitation${result.invited === 1 ? "" : "s"} sent for ${result.vacancyTitle}.`}
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              {result.skipped > 0 && result.invited > 0
                ? `${result.skipped} couldn't receive an invite (consent or already invited)  counts only, per-person reasons stay in the audit log. `
                : ""}
              Track responses on the vacancy&rsquo;s pipeline panel.
            </p>
          </div>
        </div>
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
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (vacancies.length === 0) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          You don&rsquo;t have an open vacancy yet. Create one now &mdash;
          you&rsquo;ll come straight back here with your selection to
          finish the invites.
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
            href={`/${locale}/employer/vacancies/new?returnTo=${encodeURIComponent(hereWithInviteFlag())}`}
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)]"
          >
            Create a vacancy
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  return (
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
            const isSelected = selectedId === v.id;
            return (
              <li key={v.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? "border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)]"
                      : "border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-selection-vacancy"
                    value={v.id}
                    checked={isSelected}
                    disabled={pending}
                    onChange={() => setSelectedId(v.id)}
                    className="size-4"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{v.title}</span>
                    {v.locationLabel && (
                      <span className="block truncate text-[0.7rem] text-[color:var(--color-ink-soft)]">
                        {v.locationLabel}
                      </span>
                    )}
                  </span>
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
          {personalNote.length} / 200 chars. Sent with every invite in
          this batch. POPIA s.16: keep it respectful and role-relevant.
        </span>
      </label>

      <a
        href={`/${locale}/employer/vacancies/new?returnTo=${encodeURIComponent(hereWithInviteFlag())}`}
        className="text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)] underline-offset-2 hover:text-[color:var(--color-ink)] hover:underline"
      >
        Or create a new vacancy (you&rsquo;ll come back here)
      </a>

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
          onClick={handleSend}
          disabled={pending || !selectedId}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          )}
          Send {selection.length} invitation{selection.length === 1 ? "" : "s"}
        </button>
      </footer>
    </fieldset>
  );
}
