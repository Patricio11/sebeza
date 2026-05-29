"use client";

/**
 * Phase 9.20 Tier 3  client island for "Mark departed" + the
 * re-engage panel that follows a successful departure.
 *
 * Two states:
 *
 *   Trigger: a button on the detail page's Lifecycle panel. Opens
 *     the departure modal (date picker + category select + optional
 *     500-char note).
 *
 *   Re-engage: after the action succeeds, the modal swaps to a
 *     compact list of the org's currently-open vacancies. Selecting
 *     one fires the existing bulkInviteToVacancy(profileId)  no new
 *     consent gate (D7), the same vacancy-matching consent check the
 *     bulk-invite path always applies.
 *
 * The two-step modal flow lives in ONE island so the success ->
 * re-engage transition feels seamless. Pressing Close (or dismissing)
 * after departure has been recorded still refreshes the page.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { LogOut, X, ChevronRight, Send } from "lucide-react";
import {
  PLACEMENT_DEPARTURE_CATEGORIES,
  type PlacementDepartureCategory,
} from "@/lib/employer/placement-lifecycle-types";

const NOTE_MAX = 500;

interface OpenVacancyOption {
  vacancyId: string;
  title: string;
}

interface Props {
  placementId: string;
  profileId: string;
  employeeName: string;
  hireDateIso: string;
  /** Open vacancies for the re-engage panel (D7). Pre-loaded server-side. */
  openVacancies: OpenVacancyOption[];
  /** Server actions threaded through as closures. */
  departureAction: (input: {
    placementId: string;
    departureDate: string;
    category: PlacementDepartureCategory;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  reengageAction: (input: {
    vacancyId: string;
    profileId: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
}

type Step = "closed" | "form" | "reengage" | "reengaged";

export function DepartureIsland({
  placementId,
  profileId,
  employeeName,
  hireDateIso,
  openVacancies,
  departureAction,
  reengageAction,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [departureDate, setDepartureDate] = useState<string>(
    isoDateToday(),
  );
  const [category, setCategory] = useState<PlacementDepartureCategory | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [chosenVacancyId, setChosenVacancyId] = useState<string | null>(null);

  function onConfirmDeparture() {
    setError(null);
    if (!category) {
      setError("Please pick a departure category.");
      return;
    }
    const trimmed = note.trim();
    startTransition(async () => {
      const res = await departureAction({
        placementId,
        departureDate,
        category,
        ...(trimmed.length > 0 ? { note: trimmed } : {}),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Success  pivot to the re-engage panel without closing the
      // modal. Refresh so the page's status pill + timeline update
      // even if the user closes the re-engage step without inviting.
      router.refresh();
      setStep(openVacancies.length > 0 ? "reengage" : "reengaged");
    });
  }

  function onSendReengage() {
    setError(null);
    if (!chosenVacancyId) return;
    startTransition(async () => {
      const res = await reengageAction({
        vacancyId: chosenVacancyId,
        profileId,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setStep("reengaged");
      router.refresh();
    });
  }

  function onClose() {
    setStep("closed");
    setNote("");
    setError(null);
    setChosenVacancyId(null);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setStep("form")}
      >
        <LogOut className="size-4" aria-hidden="true" />
        Mark as departed
      </Button>

      {step !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`departure-${placementId}-h`}
          className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) onClose();
          }}
        >
          <div className="w-full max-w-md rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5 shadow-xl md:rounded-[var(--radius-md)] md:p-7">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3
                id={`departure-${placementId}-h`}
                className="font-display text-xl text-[color:var(--color-ink)]"
              >
                {step === "form" && `Mark ${employeeName} as departed`}
                {step === "reengage" && `${employeeName} is back on the market`}
                {step === "reengaged" && "Done."}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                aria-label="Close"
                className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {step === "form" && (
              <DepartureForm
                hireDateIso={hireDateIso}
                departureDate={departureDate}
                onDepartureDateChange={setDepartureDate}
                category={category}
                onCategoryChange={setCategory}
                note={note}
                onNoteChange={setNote}
                pending={pending}
              />
            )}

            {step === "reengage" && (
              <ReengagePanel
                openVacancies={openVacancies}
                chosenVacancyId={chosenVacancyId}
                onChoose={setChosenVacancyId}
                pending={pending}
              />
            )}

            {step === "reengaged" && (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                {chosenVacancyId
                  ? "Invite queued. The seeker will be notified via the same channel as your bulk-invite flow  if they revoked vacancy-invite consent post-departure, the send is silently skipped per the existing audit-only policy."
                  : "Departure logged. You can come back any time and invite them to another role  the re-engage panel will also surface from the list view next time they show up."}
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {step === "form" && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={onClose}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={onConfirmDeparture}
                    disabled={pending}
                  >
                    {pending ? "Saving" : "Mark as departed"}
                  </Button>
                </>
              )}
              {step === "reengage" && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setStep("reengaged")}
                    disabled={pending}
                  >
                    Not now
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={onSendReengage}
                    disabled={pending || !chosenVacancyId}
                  >
                    <Send className="size-4" aria-hidden="true" />
                    {pending ? "Sending" : "Send invite"}
                  </Button>
                </>
              )}
              {step === "reengaged" && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onClose}
                  disabled={pending}
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DepartureForm({
  hireDateIso,
  departureDate,
  onDepartureDateChange,
  category,
  onCategoryChange,
  note,
  onNoteChange,
  pending,
}: {
  hireDateIso: string;
  departureDate: string;
  onDepartureDateChange: (v: string) => void;
  category: PlacementDepartureCategory | "";
  onCategoryChange: (v: PlacementDepartureCategory | "") => void;
  note: string;
  onNoteChange: (v: string) => void;
  pending: boolean;
}) {
  const hireDateOnly = hireDateIso.slice(0, 10);
  const today = isoDateToday();
  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        Logs the date + a structured category. We deliberately do
        <strong> not </strong>capture the *reason*  the category is the
        fact, the rest stays in your team&rsquo;s own records.
      </p>

      <div>
        <label
          htmlFor="departure-date"
          className="block text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
        >
          Departure date
        </label>
        <input
          id="departure-date"
          type="date"
          value={departureDate}
          onChange={(e) => onDepartureDateChange(e.target.value)}
          min={hireDateOnly}
          max={today}
          disabled={pending}
          className="mt-1.5 h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-ink)]"
        />
      </div>

      <fieldset>
        <legend className="block text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          Category
        </legend>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {PLACEMENT_DEPARTURE_CATEGORIES.map((opt) => {
            const checked = category === opt.value;
            return (
              <label
                key={opt.value}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-3 text-sm transition-colors " +
                  (checked
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-paper)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-ink)]")
                }
              >
                <input
                  type="radio"
                  name="departure-category"
                  value={opt.value}
                  checked={checked}
                  onChange={() => onCategoryChange(opt.value)}
                  disabled={pending}
                  className="mt-0.5 size-4 cursor-pointer accent-[color:var(--color-ink)]"
                />
                <span className="flex-1">
                  <span className="font-display text-base text-[color:var(--color-ink)]">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[color:var(--color-ink-soft)]">
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="departure-note"
          className="flex items-baseline justify-between text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
        >
          <span>
            Optional note
            <span className="ml-1 text-[color:var(--color-ink-soft)]">
              (org-private)
            </span>
          </span>
          <span
            className={
              "text-[0.65rem] tracking-normal " +
              (note.length > NOTE_MAX
                ? "text-[color:var(--color-danger)]"
                : "text-[color:var(--color-ink-soft)]")
            }
            aria-live="polite"
          >
            {note.length} / {NOTE_MAX}
          </span>
        </label>
        <textarea
          id="departure-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={pending}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder="Appended to the durable internal note. Use for your own context  never the disciplinary reason."
          className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-sm text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]"
        />
      </div>
    </div>
  );
}

function ReengagePanel({
  openVacancies,
  chosenVacancyId,
  onChoose,
  pending,
}: {
  openVacancies: OpenVacancyOption[];
  chosenVacancyId: string | null;
  onChoose: (id: string) => void;
  pending: boolean;
}) {
  if (openVacancies.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        You don&rsquo;t have any open vacancies right now  nothing to
        re-engage on. Their dossier stays accessible the next time
        you open a role they&rsquo;d be a fit for.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        Want to invite them to one of your other open vacancies? Same
        consent + audit path as the bulk-invite flow  if they revoked
        vacancy-invite consent post-departure, the send is silently
        skipped (audit only).
      </p>
      <ul className="space-y-1.5">
        {openVacancies.map((v) => {
          const chosen = chosenVacancyId === v.vacancyId;
          return (
            <li key={v.vacancyId}>
              <button
                type="button"
                onClick={() => onChoose(v.vacancyId)}
                disabled={pending}
                aria-pressed={chosen}
                className={
                  "flex w-full items-center justify-between rounded-[var(--radius-sm)] border p-3 text-left text-sm transition-colors " +
                  (chosen
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-paper)] text-[color:var(--color-ink)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                }
              >
                <span className="font-display">{v.title}</span>
                <ChevronRight
                  className="size-4 text-[color:var(--color-ink-soft)]"
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function isoDateToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
