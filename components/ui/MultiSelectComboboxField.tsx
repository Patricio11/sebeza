"use client";

/**
 * MultiSelectComboboxField  typeahead multi-select with chip display.
 *
 * Built for the skills picker on the vacancy form + the seeker profile
 * editor (where the current "all chips visible" pattern stops scaling
 * once the taxonomy passes ~30 entries). General-purpose enough that
 * other multi-select needs can adopt it: documents required, work
 * availability extras, etc.
 *
 * Behaviour
 *   - Single text input at the top. Type to filter the dropdown.
 *   - Selected values render as chips ABOVE the input, each with an X
 *     to remove. Backspace at empty input removes the last chip.
 *   - Dropdown opens on focus + on typing. Suggested options (passed
 *     via `suggestedValues`) render FIRST with a small "Suggested"
 *     divider; the remaining options follow alphabetically. Already-
 *     selected options are hidden from the dropdown.
 *   - Keyboard: ArrowDown / ArrowUp navigate; Enter selects the
 *     active option; Esc closes; Backspace at empty input removes
 *     the last chip.
 *   - `allowOther`: when the typed query doesn't match any option,
 *     a footer "Suggest <query>" row appears; selecting it fires
 *     `onOtherSubmit(query)` (the parent component decides where the
 *     suggestion goes  taxonomy queue, custom slug, etc.) and adds
 *     the typed text as a chip with a marker so the form can detect
 *     it on submit.
 *   - Mobile-first: dropdown grows the parent's width; chips wrap.
 *
 * What this is NOT
 *   - Not a tree picker, not multi-level. Flat options only.
 *   - Not async-loaded. Caller passes the full options array; for
 *     500+ entries the client-side filter is still fast.
 *   - Not the right component for picker-with-proficiency-+-years
 *     (that's SkillsEditor's per-row UI; this component just adds /
 *     removes slugs; the per-skill editor lives below).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, X, Plus } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  /** Optional id for the input (used by <label htmlFor>). */
  id?: string;
  /** Visible label above the field. */
  label: string;
  /** Optional helper text below the field. */
  helpText?: string;
  /** Currently-selected values (slugs). Ordered, persists order. */
  values: string[];
  /** Called with the new selection. Caller decides how to persist. */
  onChange: (next: string[]) => void;
  /** The full option set. */
  options: MultiSelectOption[];
  /** Optional subset that's surfaced FIRST in the dropdown (the
   *  vacancy form passes the profession-related skills here). The
   *  values must be present in `options`. */
  suggestedValues?: string[];
  /** Placeholder shown in the input when nothing is typed. */
  placeholder?: string;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Allow the user to suggest a new value not in `options`. When the
   *  query has no exact match, a "Suggest …" footer appears. */
  allowOther?: boolean;
  /** Label for the suggest footer. Default: "Suggest a new entry". */
  otherLabel?: string;
  /** Called when the user picks the suggest footer. The parent is
   *  responsible for firing whatever server action records the
   *  suggestion. The typed text is also added to `values` as a
   *  literal chip. */
  onOtherSubmit?: (text: string) => void;
  /** Split a comma-separated "Other" entry into several values, so typing
   *  "a, b, c" then choosing Suggest adds three chips (one per item) instead
   *  of one. OFF by default — some free-text values legitimately contain
   *  commas (e.g. a company name "Smith, Jones & Co."). Enable on multi-value
   *  free-text fields like skills. */
  splitOtherOnComma?: boolean;
  /** Optional className for the outer wrapper. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────

function rank(label: string, q: string): number {
  if (!q) return 0;
  const lower = label.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return -1;
  return idx === 0 ? 0 : 1 + idx;
}

export function MultiSelectComboboxField({
  id,
  label,
  helpText,
  values,
  onChange,
  options,
  suggestedValues,
  placeholder = "Type to search…",
  disabled,
  allowOther,
  otherLabel = "Suggest a new entry",
  onOtherSubmit,
  splitOtherOnComma,
  className,
}: Props) {
  const reactId = useId();
  const inputId = id ?? `mscb-${reactId}`;
  const listboxId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const optionByValue = useMemo(() => {
    const m = new Map<string, MultiSelectOption>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const suggestedSet = useMemo(
    () => new Set(suggestedValues ?? []),
    [suggestedValues],
  );
  const selectedSet = useMemo(() => new Set(values), [values]);

  // Filter + rank: hide already-selected; query-rank the rest.
  // Suggested options bubble up regardless of alphabetical order.
  const { suggestedFiltered, restFiltered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const suggestedRows: { o: MultiSelectOption; r: number }[] = [];
    const restRows: { o: MultiSelectOption; r: number }[] = [];
    for (const o of options) {
      if (selectedSet.has(o.value)) continue;
      const r = rank(o.label, q);
      if (q && r === -1) continue;
      if (suggestedSet.has(o.value)) suggestedRows.push({ o, r });
      else restRows.push({ o, r });
    }
    suggestedRows.sort((a, b) => (q ? a.r - b.r : a.o.label.localeCompare(b.o.label)));
    restRows.sort((a, b) => (q ? a.r - b.r : a.o.label.localeCompare(b.o.label)));
    return {
      suggestedFiltered: suggestedRows.map((x) => x.o),
      restFiltered: restRows.map((x) => x.o),
    };
  }, [options, query, selectedSet, suggestedSet]);

  // Flat list for arrow-key navigation: suggested then rest.
  const flat = useMemo(
    () => [...suggestedFiltered, ...restFiltered],
    [suggestedFiltered, restFiltered],
  );

  // "Other" footer is visible when allowOther + query is non-trivial
  // + no exact case-insensitive match on label exists in flat OR in
  // the full options. Exact-match check uses the full options so we
  // never offer "Suggest React" when "React" exists but is already
  // selected.
  const qTrim = query.trim();
  const showOther =
    !!allowOther &&
    qTrim.length >= 2 &&
    !options.some((o) => o.label.toLowerCase() === qTrim.toLowerCase());

  // The free-text entries the "Suggest" footer will add. With
  // `splitOtherOnComma`, "a, b, c" → ["a","b","c"] (one chip each); otherwise
  // the whole query is a single entry.
  const otherParts = useMemo(() => {
    if (!qTrim) return [];
    if (!splitOtherOnComma) return [qTrim];
    return qTrim
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length >= 1);
  }, [qTrim, splitOtherOnComma]);

  // Length of the navigable list including the "Other" row.
  const navLen = flat.length + (showOther ? 1 : 0);

  // Reset active index whenever the list changes.
  useEffect(() => {
    setActiveIdx((prev) => (prev >= navLen ? 0 : prev));
  }, [navLen]);

  // Outside-click closes the dropdown without committing anything.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!containerRef.current) return;
      if (e.target instanceof Node && containerRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const addValue = useCallback(
    (v: string) => {
      if (selectedSet.has(v)) return;
      onChange([...values, v]);
    },
    [values, onChange, selectedSet],
  );

  const removeValue = useCallback(
    (v: string) => {
      onChange(values.filter((x) => x !== v));
    },
    [values, onChange],
  );

  const pickOption = useCallback(
    (o: MultiSelectOption) => {
      addValue(o.value);
      setQuery("");
      setActiveIdx(0);
      // Keep focus on the input so the user can keep typing.
      inputRef.current?.focus();
    },
    [addValue],
  );

  const pickOther = useCallback(() => {
    if (qTrim.length < 2 || otherParts.length === 0) return;
    // Add each part as its own value. A part that matches a catalogue option
    // (by label, case-insensitive) is added as the canonical value; the rest
    // are free-text "Other" suggestions — the form's submit path sees a value
    // that isn't in `options.value`, and `onOtherSubmit` fires per new part so
    // the parent can record each suggestion.
    const additions: string[] = [];
    for (const part of otherParts) {
      const match = options.find(
        (o) => o.label.toLowerCase() === part.toLowerCase(),
      );
      const value = match ? match.value : part;
      if (selectedSet.has(value) || additions.includes(value)) continue;
      additions.push(value);
      if (!match) onOtherSubmit?.(part);
    }
    if (additions.length > 0) onChange([...values, ...additions]);
    setQuery("");
    setActiveIdx(0);
    inputRef.current?.focus();
  }, [qTrim, otherParts, options, selectedSet, values, onChange, onOtherSubmit]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((prev) => (prev + 1) % Math.max(navLen, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((prev) => (prev - 1 + Math.max(navLen, 1)) % Math.max(navLen, 1));
      return;
    }
    if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      if (activeIdx < flat.length) {
        const opt = flat[activeIdx];
        if (opt) pickOption(opt);
        return;
      }
      if (showOther && activeIdx === flat.length) {
        pickOther();
        return;
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Backspace" && query === "" && values.length > 0) {
      // Remove the last chip when the user keeps hitting Backspace at
      // empty input. Same idiom as Notion / Linear tag inputs.
      e.preventDefault();
      const last = values[values.length - 1];
      if (last) removeValue(last);
      return;
    }
  }

  const renderChipLabel = (v: string): string => {
    const opt = optionByValue.get(v);
    if (opt) return opt.label;
    // Free-text "Other" chip  show the raw text.
    return v;
  };

  return (
    <div ref={containerRef} className={className ?? "relative"}>
      <label
        htmlFor={inputId}
        className="mb-1 block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
      >
        {label}
      </label>

      {/* Selected chips */}
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => {
            const isOther = !optionByValue.has(v);
            return (
              <li key={v}>
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs " +
                    (isOther
                      ? "border border-dashed border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                      : "border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]")
                  }
                >
                  {renderChipLabel(v)}
                  {isOther && (
                    <span
                      aria-label="Pending admin review"
                      title="Pending admin review"
                      className="ml-0.5 text-[0.6rem] uppercase tracking-[0.16em] opacity-70"
                    >
                      pending
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${renderChipLabel(v)}`}
                    onClick={() => removeValue(v)}
                    disabled={disabled}
                    className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-[color:var(--color-ink)]/10"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 pr-9 text-sm text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
      </div>

      {helpText && (
        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
          {helpText}
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-press"
        >
          {flat.length === 0 && !showOther && (
            <p className="px-3 py-3 text-xs text-[color:var(--color-ink-soft)]">
              {query.trim() === ""
                ? "All available options are already selected."
                : "No matches. Try a different word."}
            </p>
          )}

          {suggestedFiltered.length > 0 && (
            // Phase 11.5.9  wrap each section in role="group" with
            // an aria-label matching the visible divider text so
            // VoiceOver / NVDA announce the grouping.
            <div role="group" aria-label="Suggested for this role">
              <p className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Suggested for this role
              </p>
              {suggestedFiltered.map((opt, i) => (
                <OptionRow
                  key={opt.value}
                  option={opt}
                  active={i === activeIdx}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => pickOption(opt)}
                />
              ))}
            </div>
          )}

          {restFiltered.length > 0 && (
            <div
              role="group"
              aria-label={
                suggestedFiltered.length > 0
                  ? "All other options"
                  : "Options"
              }
            >
              {suggestedFiltered.length > 0 && (
                <p className="border-b border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  All other options
                </p>
              )}
              {restFiltered.map((opt, i) => {
                const idx = suggestedFiltered.length + i;
                return (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    active={idx === activeIdx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => pickOption(opt)}
                  />
                );
              })}
            </div>
          )}

          {showOther && (
            <>
              <p className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
                {otherLabel}
              </p>
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(flat.length)}
                onClick={pickOther}
                className={
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors " +
                  (activeIdx === flat.length
                    ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-ink)]"
                    : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]")
                }
              >
                <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                {otherParts.length > 1 ? (
                  <span>
                    Suggest{" "}
                    <strong className="font-semibold">
                      {otherParts.length} entries
                    </strong>{" "}
                    for admin review
                    <span className="mt-0.5 block text-[0.7rem] font-normal text-[color:var(--color-ink-soft)]">
                      {otherParts.join(" · ")}
                    </span>
                  </span>
                ) : (
                  <span>
                    Suggest <strong className="font-semibold">{qTrim}</strong> for
                    admin review
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function OptionRow({
  option,
  active,
  onMouseEnter,
  onClick,
}: {
  option: MultiSelectOption;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={
        "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors " +
        (active
          ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-ink)]"
          : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]")
      }
    >
      <span>{option.label}</span>
    </button>
  );
}
