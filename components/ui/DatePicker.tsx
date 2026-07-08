"use client";

/**
 * DatePicker  Civic Editorial day-precision date picker.
 *
 * Sibling of `MonthYearPicker`. External contract is the ISO yyyy-mm-dd
 * string ("" = no selection)  same shape `<input type="date">` emits,
 * so this is a drop-in replacement anywhere we'd reach for that.
 *
 * Built for day-of-birth at sign-up (Phase 9.16) where the native
 * picker is hostile on Android (different vendor UIs, no year-jumper
 * on older builds) and we want a hard 14100 age window enforced
 * inline.
 *
 * UX:
 *   - Click the field OR the calendar icon to open
 *   - Three views: year grid → month grid → day grid
 *   - Title row tap cycles back up the hierarchy (day → month → year)
 *   - `‹` / `›` step one unit at the current view's grain
 *   - Footer: Clear · Today (Today greyed out when outside min/max)
 *   - Mobile bottom-sheet, md+ dropdown
 *
 * Accessibility:
 *   - Field is a button with aria-expanded + aria-haspopup
 *   - Day grid uses role="listbox" with arrow-key navigation
 *   - Selected day gets aria-selected
 *   - Out-of-range days are aria-disabled
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  /** Optional id for the underlying button (used by <label htmlFor>). */
  id?: string;
  /** Visible label above the field. */
  label: string;
  /** ISO yyyy-mm-dd string. "" = no selection. */
  value: string;
  /** Called with a new ISO yyyy-mm-dd string (or "" if cleared). */
  onChange: (value: string) => void;
  /** Earliest selectable date, inclusive. ISO yyyy-mm-dd. */
  minDate?: string;
  /** Latest selectable date, inclusive. ISO yyyy-mm-dd. */
  maxDate?: string;
  /** Shown when value is "". Default: "Select date". */
  placeholder?: string;
  /** Optional helper text shown below the field. */
  helpText?: string;
  /** Disable the picker. */
  disabled?: boolean;
  /** Error message shown below the field (red). */
  error?: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
] as const;

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Mon-first week  matches SA + UK convention and survey of locales.
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type View = "days" | "months" | "years";

interface Ymd {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

function parseValue(v: string): Ymd | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatValue(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function formatDisplay(v: string): string {
  const parsed = parseValue(v);
  if (!parsed) return "";
  // Long-form: "15 June 1990"  matches the SA-readable form on
  // official docs (Home Affairs records).
  return `${parsed.day} ${FULL_MONTHS[parsed.month - 1]} ${parsed.year}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-12; passing day 0 of the next month gives last day of this.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Mon=0 .. Sun=6 (Mon-first calendar). */
function mondayOffset(year: number, month: number): number {
  // JS getUTCDay(): Sun=0, Mon=1, ...
  const jsDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (jsDay + 6) % 7;
}

function isBefore(a: Ymd, b: Ymd): boolean {
  if (a.year !== b.year) return a.year < b.year;
  if (a.month !== b.month) return a.month < b.month;
  return a.day < b.day;
}

function isAfter(a: Ymd, b: Ymd): boolean {
  return isBefore(b, a);
}

function clampToRange(
  candidate: Ymd,
  min: Ymd | null,
  max: Ymd | null,
): Ymd {
  if (min && isBefore(candidate, min)) return min;
  if (max && isAfter(candidate, max)) return max;
  return candidate;
}

// ─────────────────────────────────────────────────────────────────────

export function DatePicker({
  id,
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Select date",
  helpText,
  disabled,
  error,
  className,
}: Props) {
  const reactId = useId();
  const buttonId = id ?? `dpicker-${reactId}`;
  const popoverId = `${buttonId}-popover`;

  const min = useMemo(() => (minDate ? parseValue(minDate) : null), [minDate]);
  const max = useMemo(() => (maxDate ? parseValue(maxDate) : null), [maxDate]);

  const today = useMemo(() => {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  }, []);

  const parsed = parseValue(value);

  const initialView = useMemo<Ymd>(() => {
    if (parsed) return parsed;
    // No selection yet  open at the latest allowed date if max is in the
    // past (DOB case), otherwise today clamped into range.
    if (max && isAfter(today, max)) return max;
    if (min && isBefore(today, min)) return min;
    return today;
  }, [parsed, today, min, max]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);
  const [focusedDay, setFocusedDay] = useState<number>(
    parsed?.day ?? initialView.day,
  );

  // Year grid pagination: which 12-year page we're showing.
  const [yearPageStart, setYearPageStart] = useState<number>(() => {
    const anchor = parsed?.year ?? initialView.year;
    return Math.floor(anchor / 12) * 12;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // When opening, re-anchor the visible page to whatever's already selected.
  useEffect(() => {
    if (!open) return;
    const anchor = parsed ?? initialView;
    setViewYear(anchor.year);
    setViewMonth(anchor.month);
    setFocusedDay(anchor.day);
    setYearPageStart(Math.floor(anchor.year / 12) * 12);
    setView("days");
    requestAnimationFrame(() => gridRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Outside-click closes.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selectDate = useCallback(
    (year: number, month: number, day: number) => {
      const candidate: Ymd = { year, month, day };
      if (min && isBefore(candidate, min)) return;
      if (max && isAfter(candidate, max)) return;
      onChange(formatValue(year, month, day));
      setOpen(false);
      buttonRef.current?.focus();
    },
    [onChange, min, max],
  );

  const clear = useCallback(() => {
    onChange("");
    setOpen(false);
    buttonRef.current?.focus();
  }, [onChange]);

  const goToToday = useCallback(() => {
    const target = clampToRange(today, min, max);
    selectDate(target.year, target.month, target.day);
  }, [today, min, max, selectDate]);

  const todayInRange =
    !(min && isBefore(today, min)) && !(max && isAfter(today, max));

  function stepMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  function onDayGridKey(e: React.KeyboardEvent) {
    const total = daysInMonth(viewYear, viewMonth);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (focusedDay < total) setFocusedDay(focusedDay + 1);
      else {
        stepMonth(1);
        setFocusedDay(1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (focusedDay > 1) setFocusedDay(focusedDay - 1);
      else {
        const prevTotal = daysInMonth(
          viewMonth === 1 ? viewYear - 1 : viewYear,
          viewMonth === 1 ? 12 : viewMonth - 1,
        );
        stepMonth(-1);
        setFocusedDay(prevTotal);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = focusedDay + 7;
      if (next <= total) setFocusedDay(next);
      else {
        stepMonth(1);
        setFocusedDay(next - total);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = focusedDay - 7;
      if (next >= 1) setFocusedDay(next);
      else {
        const prevTotal = daysInMonth(
          viewMonth === 1 ? viewYear - 1 : viewYear,
          viewMonth === 1 ? 12 : viewMonth - 1,
        );
        stepMonth(-1);
        setFocusedDay(prevTotal + next);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectDate(viewYear, viewMonth, focusedDay);
    }
  }

  const displayText = formatDisplay(value);
  const titleText =
    view === "days"
      ? `${FULL_MONTHS[viewMonth - 1]} ${viewYear}`
      : view === "months"
        ? String(viewYear)
        : `${yearPageStart}${yearPageStart + 11}`;

  return (
    <div className={className ?? ""} ref={containerRef}>
      <label
        htmlFor={buttonId}
        className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
      >
        {label}
      </label>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen((v) => !v)}
        className={
          "mt-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] border bg-[color:var(--color-paper)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[color:var(--color-ink)] focus:border-[color:var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]/30 disabled:cursor-not-allowed disabled:opacity-60 " +
          (error
            ? "border-[color:var(--color-danger)]"
            : "border-[color:var(--color-hairline)]")
        }
      >
        <span
          className={
            displayText
              ? "text-[color:var(--color-ink)]"
              : "text-[color:var(--color-ink-soft)]"
          }
        >
          {displayText || placeholder}
        </span>
        <Calendar
          className="size-4 shrink-0 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-1 text-[0.7rem] text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      ) : helpText ? (
        <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          {helpText}
        </p>
      ) : null}

      {open && (
        <>
          <div
            className="fixed inset-0 z-[45] bg-[color:var(--color-ink)]/30 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            id={popoverId}
            role="dialog"
            aria-label={`${label} picker`}
            className={
              // z-[46]: above the Phase 28 floating bottom nav (z-40)  a
              // bottom sheet covers the tab bar, like a native app.
              "z-[46] " +
              "fixed inset-x-0 bottom-0 rounded-t-[var(--radius-md)] " +
              "md:absolute md:inset-x-auto md:bottom-auto md:mt-2 md:w-[320px] md:rounded-[var(--radius-md)] " +
              "border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] shadow-2xl"
            }
          >
            {/* Title row */}
            <header className="flex items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  if (view === "days") stepMonth(-1);
                  else if (view === "months") setViewYear(viewYear - 1);
                  else setYearPageStart(yearPageStart - 12);
                }}
                aria-label="Previous"
                className="cursor-pointer rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)]"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (view === "days") setView("months");
                  else if (view === "months") setView("years");
                }}
                aria-label={
                  view === "days"
                    ? "Switch to month picker"
                    : view === "months"
                      ? "Switch to year picker"
                      : "Year range"
                }
                className="cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 font-display text-lg text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper)]"
              >
                {titleText}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (view === "days") stepMonth(1);
                    else if (view === "months") setViewYear(viewYear + 1);
                    else setYearPageStart(yearPageStart + 12);
                  }}
                  aria-label="Next"
                  className="cursor-pointer rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)]"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="ml-1 cursor-pointer rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)] md:hidden"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Day view */}
            {view === "days" && (
              <div className="p-3">
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((w) => (
                    <span
                      key={w}
                      className="py-1 text-center text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
                    >
                      {w}
                    </span>
                  ))}
                </div>
                <div
                  ref={gridRef}
                  role="listbox"
                  tabIndex={0}
                  aria-label={`Days of ${FULL_MONTHS[viewMonth - 1]} ${viewYear}`}
                  onKeyDown={onDayGridKey}
                  className="grid grid-cols-7 gap-1 focus:outline-none"
                >
                  {Array.from({ length: mondayOffset(viewYear, viewMonth) }).map(
                    (_, i) => (
                      <span key={`pad-${i}`} aria-hidden="true" />
                    ),
                  )}
                  {Array.from({
                    length: daysInMonth(viewYear, viewMonth),
                  }).map((_, i) => {
                    const day = i + 1;
                    const cell: Ymd = { year: viewYear, month: viewMonth, day };
                    const outOfRange =
                      (min && isBefore(cell, min)) ||
                      (max && isAfter(cell, max));
                    const isSelected =
                      parsed?.year === viewYear &&
                      parsed?.month === viewMonth &&
                      parsed?.day === day;
                    const isToday =
                      today.year === viewYear &&
                      today.month === viewMonth &&
                      today.day === day;
                    const isFocused = focusedDay === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={outOfRange || undefined}
                        disabled={!!outOfRange}
                        tabIndex={-1}
                        onClick={() => selectDate(viewYear, viewMonth, day)}
                        onMouseEnter={() => !outOfRange && setFocusedDay(day)}
                        className={
                          "cursor-pointer rounded-[var(--radius-sm)] py-1.5 text-sm font-medium transition-colors " +
                          (isSelected
                            ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                            : isFocused
                              ? "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink)]"
                              : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]") +
                          (isToday && !isSelected
                            ? " ring-1 ring-[color:var(--color-accent)] ring-offset-1 ring-offset-[color:var(--color-paper)]"
                            : "") +
                          (outOfRange
                            ? " cursor-not-allowed opacity-30 hover:bg-transparent"
                            : "")
                        }
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Month view */}
            {view === "months" && (
              <div className="grid grid-cols-3 gap-1 p-3">
                {SHORT_MONTHS.map((m, i) => {
                  const month = i + 1;
                  // A month is out-of-range only if BOTH its first and last
                  // day fall outside the allowed band.
                  const firstDay: Ymd = { year: viewYear, month, day: 1 };
                  const lastDay: Ymd = {
                    year: viewYear,
                    month,
                    day: daysInMonth(viewYear, month),
                  };
                  const outOfRange =
                    (min && isBefore(lastDay, min)) ||
                    (max && isAfter(firstDay, max));
                  const isSelected =
                    parsed?.year === viewYear && parsed?.month === month;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!!outOfRange}
                      onClick={() => {
                        setViewMonth(month);
                        setView("days");
                      }}
                      className={
                        "cursor-pointer rounded-[var(--radius-sm)] py-2.5 text-sm font-medium transition-colors " +
                        (isSelected
                          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                          : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]") +
                        (outOfRange ? " cursor-not-allowed opacity-30" : "")
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Year view (12-year grid) */}
            {view === "years" && (
              <div className="grid grid-cols-3 gap-1 p-3">
                {Array.from({ length: 12 }).map((_, i) => {
                  const year = yearPageStart + i;
                  const firstDay: Ymd = { year, month: 1, day: 1 };
                  const lastDay: Ymd = { year, month: 12, day: 31 };
                  const outOfRange =
                    (min && isBefore(lastDay, min)) ||
                    (max && isAfter(firstDay, max));
                  const isSelected = parsed?.year === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      disabled={!!outOfRange}
                      onClick={() => {
                        setViewYear(year);
                        setView("months");
                      }}
                      className={
                        "cursor-pointer rounded-[var(--radius-sm)] py-2.5 text-sm font-medium tabular transition-colors " +
                        (isSelected
                          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                          : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]") +
                        (outOfRange ? " cursor-not-allowed opacity-30" : "")
                      }
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <footer className="flex items-center justify-between gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-2.5">
              <button
                type="button"
                onClick={clear}
                className="cursor-pointer text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] hover:underline"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={goToToday}
                disabled={!todayInRange}
                className="cursor-pointer text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline disabled:cursor-not-allowed disabled:text-[color:var(--color-ink-soft)] disabled:no-underline disabled:opacity-50"
              >
                Today
              </button>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
