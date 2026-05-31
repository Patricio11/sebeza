"use client";

/**
 * MonthYearPicker  Civic Editorial month + year picker.
 *
 * Reusable across the system anywhere we need a yyyy-mm value
 * (expected graduation, member since, hire month, etc.). The
 * external value contract is the ISO yyyy-mm string ("" = no
 * selection)  same as the native `<input type="month">` produces,
 * so this component is a drop-in replacement.
 *
 * UX:
 *   - Click the field OR the calendar icon to open
 *   - Dropdown shows the selected year with prev / next nav arrows
 *   - Month grid (3 columns × 4 rows) with the selected month
 *     highlighted in brand teal + today's month outlined in accent
 *   - Footer: Clear · This month
 *   - Click outside / Esc closes
 *   - Mobile-first: bottom-sheet on phones, dropdown on md+
 *
 * Accessibility:
 *   - Field is a button with aria-expanded + aria-haspopup
 *   - Month grid uses role="listbox" with arrow-key navigation
 *   - Enter/Space selects, Esc closes
 *   - Selected month gets aria-selected
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
  /** ISO yyyy-mm string. "" = no selection. */
  value: string;
  /** Called with a new ISO yyyy-mm string (or "" if cleared). */
  onChange: (value: string) => void;
  /** Minimum selectable year. Default: current year - 50. */
  minYear?: number;
  /** Maximum selectable year. Default: current year + 10. */
  maxYear?: number;
  /** Shown when value is "". Default: "Select month". */
  placeholder?: string;
  /** Optional helper text shown below the field. */
  helpText?: string;
  /** Disable the picker. */
  disabled?: boolean;
  /** Optional className for the outer wrapper. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
] as const;

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function parseValue(v: string): { year: number; month: number } | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function formatValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatDisplay(v: string): string {
  const parsed = parseValue(v);
  if (!parsed) return "";
  return `${FULL_MONTHS[parsed.month - 1]} ${parsed.year}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function MonthYearPicker({
  id,
  label,
  value,
  onChange,
  minYear,
  maxYear,
  placeholder = "Select month",
  helpText,
  disabled,
  className,
}: Props) {
  const reactId = useId();
  const buttonId = id ?? `mypicker-${reactId}`;
  const popoverId = `${buttonId}-popover`;

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const min = minYear ?? currentYear - 50;
  const max = maxYear ?? currentYear + 10;

  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  // Year shown in the dropdown header. Independent of `value` so the user
  // can nav around without losing the current selection.
  const [viewYear, setViewYear] = useState(parsed?.year ?? currentYear);

  // Keyboard focus tracking for the month grid.
  const [focusedMonth, setFocusedMonth] = useState<number>(
    parsed?.month ?? currentMonth,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // When opening, re-anchor viewYear to the selected year (or current).
  useEffect(() => {
    if (open) {
      setViewYear(parsed?.year ?? currentYear);
      setFocusedMonth(parsed?.month ?? currentMonth);
      // Focus the grid so arrow keys work immediately.
      requestAnimationFrame(() => gridRef.current?.focus());
    }
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

  const selectMonth = useCallback(
    (year: number, month: number) => {
      onChange(formatValue(year, month));
      setOpen(false);
      buttonRef.current?.focus();
    },
    [onChange],
  );

  const clear = useCallback(() => {
    onChange("");
    setOpen(false);
    buttonRef.current?.focus();
  }, [onChange]);

  const setThisMonth = useCallback(() => {
    onChange(formatValue(currentYear, currentMonth));
    setOpen(false);
    buttonRef.current?.focus();
  }, [currentMonth, currentYear, onChange]);

  function onGridKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = focusedMonth + 1;
      if (next > 12) {
        if (viewYear < max) {
          setViewYear(viewYear + 1);
          setFocusedMonth(1);
        }
      } else setFocusedMonth(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = focusedMonth - 1;
      if (next < 1) {
        if (viewYear > min) {
          setViewYear(viewYear - 1);
          setFocusedMonth(12);
        }
      } else setFocusedMonth(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = focusedMonth + 3;
      if (next <= 12) setFocusedMonth(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = focusedMonth - 3;
      if (next >= 1) setFocusedMonth(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectMonth(viewYear, focusedMonth);
    }
  }

  const displayText = formatDisplay(value);
  const canPrev = viewYear > min;
  const canNext = viewYear < max;

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
        onClick={() => setOpen((v) => !v)}
        className={
          "mt-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[color:var(--color-ink)] focus:border-[color:var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]/30 disabled:cursor-not-allowed disabled:opacity-60"
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
      {helpText && (
        <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          {helpText}
        </p>
      )}

      {open && (
        <>
          {/* Mobile backdrop  closes on tap */}
          <div
            className="fixed inset-0 z-20 bg-[color:var(--color-ink)]/30 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            id={popoverId}
            role="dialog"
            aria-label={`${label} picker`}
            className={
              // Mobile: full-width bottom-sheet pinned to bottom of viewport.
              // md+: dropdown anchored to the field below it.
              "z-30 " +
              "fixed inset-x-0 bottom-0 rounded-t-[var(--radius-md)] " +
              "md:absolute md:inset-x-auto md:bottom-auto md:mt-2 md:w-[320px] md:rounded-[var(--radius-md)] " +
              "border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] shadow-2xl"
            }
          >
            {/* Year header with nav */}
            <header className="flex items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setViewYear(viewYear - 1)}
                aria-label="Previous year"
                className="cursor-pointer rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span
                className="font-display text-2xl tabular text-[color:var(--color-ink)]"
                aria-live="polite"
              >
                {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setViewYear(viewYear + 1)}
                  aria-label="Next year"
                  className="cursor-pointer rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                {/* Mobile-only close X */}
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

            {/* Month grid. Phase 11.5.15  `aria-activedescendant` lets
                screen readers announce the currently-focused month
                without moving DOM focus off the listbox container,
                which is the WAI-ARIA-recommended pattern for a
                composite single-focus widget. */}
            <div
              ref={gridRef}
              role="listbox"
              tabIndex={0}
              aria-label={`Months of ${viewYear}`}
              aria-activedescendant={`myp-month-${viewYear}-${focusedMonth}`}
              onKeyDown={onGridKey}
              className="grid grid-cols-3 gap-1 p-3 focus:outline-none"
            >
              {MONTHS.map((m, i) => {
                const month = i + 1;
                const isSelected =
                  parsed?.year === viewYear && parsed?.month === month;
                const isToday =
                  viewYear === currentYear && month === currentMonth;
                const isFocused = focusedMonth === month;
                return (
                  <button
                    key={m}
                    id={`myp-month-${viewYear}-${month}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => selectMonth(viewYear, month)}
                    onMouseEnter={() => setFocusedMonth(month)}
                    className={
                      "relative cursor-pointer rounded-[var(--radius-sm)] py-2.5 text-sm font-medium transition-colors " +
                      (isSelected
                        ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                        : isFocused
                          ? "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink)]"
                          : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]") +
                      (isToday && !isSelected
                        ? " ring-1 ring-[color:var(--color-accent)] ring-offset-1 ring-offset-[color:var(--color-paper)]"
                        : "")
                    }
                  >
                    {m}
                  </button>
                );
              })}
            </div>

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
                onClick={setThisMonth}
                className="cursor-pointer text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
              >
                This month
              </button>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
