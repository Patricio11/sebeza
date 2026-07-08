"use client";

/**
 * Sebenza ComboboxField  searchable Civic Editorial select.
 *
 * Replaces plain <select> in surfaces where the option list is long
 * enough (>10 items) that type-to-filter is a meaningful UX win.
 * First use: profession picker on sign-up, profile editor, vacancy
 * form. Reusable elsewhere (institution / city / skill pickers all
 * fit the same shape).
 *
 * UX:
 *   - Click field to open; type to filter (case-insensitive substring)
 *   - Ranks by "starts with" first, then "contains"
 *   - ArrowDown/ArrowUp navigate, Enter selects, Esc closes
 *   - Click outside closes
 *   - Clear button when there's a value
 *   - Mobile: bottom-sheet (matches MonthYearPicker idiom)
 *   - Desktop: dropdown anchored below the field
 *
 * Accessibility:
 *   - role="combobox" on the input
 *   - role="listbox" on the dropdown, role="option" on items
 *   - aria-expanded + aria-controls + aria-activedescendant
 *   - Visually-hidden status updates announce result counts to SRs
 *
 * Value contract: the LABEL string. Matches the existing convention
 * for `profiles.profession` (stored as label, not slug) so this is a
 * drop-in replacement for <SelectField> with the same value flow.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Check, ChevronDown, PencilLine, Search, X } from "lucide-react";

export interface ComboboxOption {
  /** The value posted to the backend / used in state. */
  value: string;
  /** The visible label. Defaults to value when omitted. */
  label?: string;
  /** Optional muted text shown under the label. */
  description?: string;
  /** Disable this option in the dropdown. */
  disabled?: boolean;
  /**
   * Optional leading slot rendered before the label  e.g. a flag
   * emoji on a country picker, an icon character, a 2-letter code.
   * Deliberately a string (not ReactNode) so it stays serialisable +
   * trivially passable from server components. Excluded from the
   * type-to-filter rank so typing "south" still ranks "South Africa"
   * at idx 0 rather than after the flag glyph.
   */
  leading?: string;
}

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
  required?: boolean;
  /** Form-submission name when used inside an uncontrolled <form>. */
  name?: string;
  /** Empty-results footer  string OR ReactNode. */
  emptyText?: string;
  className?: string;
  /**
   * Phase 9.15  show an "Other (specify)" footer option that switches the
   * field to free-text mode. The parent receives the typed value via the
   * regular `onChange` and is responsible for firing the suggestion
   * submission Server Action when the value isn't in `options`.
   */
  allowOther?: boolean;
  /**
   * Phase 9.15  optional callback for when the user explicitly confirms a
   * free-text "Other" entry (Enter or blur). Fires AFTER onChange. Use
   * this to fire the suggestion submission if you want immediate review.
   * Parent can alternatively detect Other-ness on form-submit by checking
   * if `value` isn't in `options`.
   */
  onOtherSubmit?: (text: string) => void;
  /** Label for the Other footer option. Default: "Other (specify)". */
  otherLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

function rank(option: ComboboxOption, q: string): number {
  if (!q) return 0;
  const label = (option.label ?? option.value).toLowerCase();
  const idx = label.indexOf(q);
  if (idx === -1) return -1;
  // Starts-with wins; then earliest-substring wins.
  return idx === 0 ? 0 : 1 + idx;
}

// ─────────────────────────────────────────────────────────────────────────────

export function ComboboxField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Search…",
  helpText,
  disabled,
  required,
  name,
  emptyText = "No matches  refine your search or contact support if your option isn't listed.",
  className,
  allowOther,
  onOtherSubmit,
  otherLabel = "Other (specify)",
}: Props) {
  const reactId = useId();
  const buttonId = id ?? `combo-${reactId}`;
  const popoverId = `${buttonId}-popover`;
  const statusId = `${buttonId}-status`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  // Phase 9.15  free-text "Other" mode. Set when the user clicks the
  // Other footer option. Cleared by the "Pick from list" revert link.
  const [otherMode, setOtherMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);

  // Selected option (matches value field, case-insensitive on label fallback).
  const selected = useMemo(
    () =>
      options.find(
        (o) =>
          o.value === value ||
          (o.label ?? o.value).toLowerCase() === value.toLowerCase(),
      ),
    [options, value],
  );

  // If value is set but doesn't match any option, infer Other mode on mount.
  const valueIsOther = !!value && !selected;
  useEffect(() => {
    if (allowOther && valueIsOther) setOtherMode(true);
  }, [allowOther, valueIsOther]);

  // Filtered + sorted list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options
      .map((o) => ({ o, r: rank(o, q) }))
      .filter((x) => x.r !== -1)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.o);
  }, [options, query]);

  // Reset focus index when filter changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // When opening: pre-focus the search input.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  // Outside-click closes.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Esc closes (when focus is on the search input the input's own
  // handler catches this; this listener covers other focus states).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const select = useCallback(
    (opt: ComboboxOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const clear = useCallback(() => {
    onChange("");
    setOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) select(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const displayLabel = selected?.label ?? selected?.value ?? value;
  const hasValue = !!value;

  // Phase 9.15  free-text "Other" mode: render a text input instead of
  // the picker trigger. The "Pick from list" link reverts to the picker.
  if (allowOther && otherMode) {
    return (
      <div className={className ?? ""}>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor={buttonId}
            className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
          >
            {label}
            {required && (
              <span aria-hidden="true" className="ml-1 text-[color:var(--color-accent)]">
                *
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={() => {
              setOtherMode(false);
              onChange("");
              triggerRef.current?.focus();
            }}
            className="inline-flex cursor-pointer items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <ArrowLeft className="size-3" aria-hidden="true" /> Pick from list
          </button>
        </div>
        <div className="mt-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-3 py-2.5">
          <PencilLine
            className="size-4 shrink-0 text-[color:var(--color-accent)]"
            aria-hidden="true"
          />
          <input
            ref={otherRef}
            id={buttonId}
            name={name}
            type="text"
            disabled={disabled}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              const trimmed = e.target.value.trim();
              if (trimmed && onOtherSubmit) onOtherSubmit(trimmed);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder={`Type your ${label.toLowerCase()}`}
            maxLength={80}
            className="w-full bg-transparent text-sm text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-ink-soft)]"
          />
        </div>
        <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          We&rsquo;ll review your entry so it can become part of the canonical
          list. Up to 80 characters.
        </p>
      </div>
    );
  }

  return (
    <div className={className ?? ""} ref={containerRef}>
      <label
        htmlFor={buttonId}
        className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-[color:var(--color-accent)]">
            *
          </span>
        )}
      </label>
      <button
        ref={triggerRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[color:var(--color-ink)] focus:border-[color:var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={
            "truncate " +
            (hasValue
              ? "text-[color:var(--color-ink)]"
              : "text-[color:var(--color-ink-soft)]")
          }
        >
          {hasValue ? (
            <>
              {selected?.leading && (
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block leading-none"
                >
                  {selected.leading}
                </span>
              )}
              {displayLabel}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  clear();
                }
              }}
              className="cursor-pointer rounded-[var(--radius-pill)] p-0.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-sunk)] hover:text-[color:var(--color-ink)]"
            >
              <X className="size-3.5" aria-hidden="true" />
            </span>
          )}
          <ChevronDown
            className={
              "size-4 text-[color:var(--color-ink-soft)] transition-transform " +
              (open ? "rotate-180" : "")
            }
            aria-hidden="true"
          />
        </span>
      </button>
      {helpText && (
        <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          {helpText}
        </p>
      )}
      {/* Hidden mirror input for uncontrolled form submission. */}
      {name && (
        <input type="hidden" name={name} value={value} />
      )}

      {open && (
        <>
          {/* Mobile backdrop */}
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
              "z-[46] flex flex-col " +
              "fixed inset-x-0 bottom-0 max-h-[80vh] rounded-t-[var(--radius-md)] " +
              "md:absolute md:inset-x-auto md:bottom-auto md:mt-2 md:w-full md:max-w-[420px] md:max-h-[360px] md:rounded-[var(--radius-md)] " +
              "border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] shadow-2xl"
            }
          >
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2.5">
              <Search
                className="size-4 shrink-0 text-[color:var(--color-ink-soft)]"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={popoverId}
                aria-activedescendant={
                  filtered[activeIdx]
                    ? `${popoverId}-opt-${activeIdx}`
                    : undefined
                }
                aria-autocomplete="list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-ink-soft)]"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="cursor-pointer rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)] md:hidden"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Status (sr-only) */}
            <p id={statusId} aria-live="polite" className="sr-only">
              {filtered.length === 0
                ? "No matches"
                : `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`}
            </p>

            {/* Option list */}
            <ul
              role="listbox"
              aria-label={label}
              className="flex-1 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-[color:var(--color-ink-soft)]">
                  {emptyText}
                </li>
              ) : (
                filtered.map((opt, i) => {
                  const isSelected =
                    selected?.value === opt.value ||
                    (selected?.label ?? selected?.value)?.toLowerCase() ===
                      (opt.label ?? opt.value).toLowerCase();
                  const isActive = i === activeIdx;
                  return (
                    <li
                      key={opt.value}
                      id={`${popoverId}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => select(opt)}
                      className={
                        "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm transition-colors " +
                        (opt.disabled
                          ? "cursor-not-allowed opacity-50 "
                          : "") +
                        (isActive
                          ? "bg-[color:var(--color-surface-sunk)] "
                          : "hover:bg-[color:var(--color-surface-sunk)] ")
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center text-[color:var(--color-brand-strong)] " +
                          (isSelected ? "" : "invisible")
                        }
                      >
                        <Check className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[color:var(--color-ink)]">
                          {opt.leading && (
                            <span
                              aria-hidden="true"
                              className="mr-2 inline-block leading-none"
                            >
                              {opt.leading}
                            </span>
                          )}
                          {opt.label ?? opt.value}
                        </span>
                        {opt.description && (
                          <span className="mt-0.5 block text-[0.7rem] text-[color:var(--color-ink-soft)]">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })
              )}
              {/* Phase 9.15  Other (specify) footer option. */}
              {allowOther && (
                <li
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange("");
                    setOtherMode(true);
                    setOpen(false);
                    requestAnimationFrame(() => otherRef.current?.focus());
                  }}
                  className="mt-1 flex cursor-pointer items-center gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-2.5 text-sm text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-tint)]"
                >
                  <PencilLine className="size-3.5" aria-hidden="true" />
                  <span className="font-medium">{otherLabel}</span>
                  <span className="ml-auto text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    type your own
                  </span>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
