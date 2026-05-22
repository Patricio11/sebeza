"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  value: string;
  label: string;
  /** Optional secondary line in the panel (NOT shown in the trigger). */
  hint?: string;
  disabled?: boolean;
}

interface Props {
  /** Becomes the name of a hidden input so native form submission still works. */
  name?: string;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled default. */
  defaultValue?: string;
  /** Called with the new value when an option is committed. */
  onChange?: (value: string) => void;
  options: CustomSelectOption[];
  /** Shown when no option is selected. */
  placeholder?: string;
  /** Used for the trigger button id (label association). */
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Trigger style:
   *  - "default" — bordered field, matches `<TextField>` height (48 px).
   *  - "compact" — inline pill (e.g. locale switcher).
   *  - "bare"    — no border or background; blends into a parent composition
   *                like the search bar's hairline-divided field cells.
   */
  variant?: "default" | "compact" | "bare";
  /** Optional override of the trigger's text size class (defaults per variant). */
  triggerTextClassName?: string;
  /** Accessible label when there's no surrounding `<label>`. */
  ariaLabel?: string;
  /** Optional leading icon in the trigger. */
  icon?: ReactNode;
}

/**
 * Custom select used throughout Sebenza. Replaces native `<select>` so every
 * dropdown matches the Mzansi National design — chevron mark, hairline border,
 * the SA palette — and feels the same on iOS, Android, macOS, Windows.
 *
 * Behaviour:
 *  - Desktop (≥md): popover panel anchored to the trigger.
 *  - Mobile (<md):  full-screen bottom sheet with backdrop + Close button,
 *                   thumb-sized rows.
 *  - Full keyboard support: Enter/Space/ArrowDown open the panel; Arrow keys
 *    move the active option; Home/End jump; Enter/Space commit; Tab/Esc close.
 *  - aria-haspopup + aria-expanded + aria-controls + role="listbox" + role="option".
 *  - Honours `prefers-reduced-motion` via the global rule in `globals.css`.
 *  - Form submission still works: a hidden `<input name>` carries the value.
 */
export function CustomSelect({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options,
  placeholder = "Select…",
  id,
  required,
  disabled,
  className,
  variant = "default",
  triggerTextClassName,
  ariaLabel,
  icon,
}: Props) {
  const generatedId = useId();
  const buttonId = id ?? `cs-${generatedId}`;
  const listboxId = `${buttonId}-listbox`;
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Portal mount + trigger position tracking. Rendering the panel into
  // `document.body` means it can't be displaced by any ancestor's overflow,
  // stacking context, or `transform` (such as our hero entrance animation).
  // The trigger's bounding rect drives the desktop popover position.
  const [mounted, setMounted] = useState(false);
  const [triggerRect, setTriggerRect] = useState<{
    top: number;
    left: number;
    bottom: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const measureTrigger = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTriggerRect({
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      width: r.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    measureTrigger();
    const onScroll = () => measureTrigger();
    const onResize = () => measureTrigger();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, measureTrigger]);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        listRef.current?.contains(target) ||
        // Click inside the panel container (which wraps the list + sheet header)
        listRef.current?.parentElement?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent | globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Lock body scroll while the mobile sheet is up (skip on desktop popover).
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // When opening, jump active option to the current selection (or the first
  // non-disabled option), and focus the listbox so arrow keys work immediately.
  useEffect(() => {
    if (!open) return;
    const startIdx =
      selectedIndex >= 0
        ? selectedIndex
        : options.findIndex((o) => !o.disabled);
    setActiveIndex(startIdx);
    // Focus the listbox so arrow keys + Enter work without an extra Tab.
    queueMicrotask(() => listRef.current?.focus());
  }, [open, selectedIndex, options]);

  // Scroll active option into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(
      `[data-idx="${activeIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const commit = useCallback(
    (newValue: string) => {
      if (!isControlled) setInternalValue(newValue);
      onChange?.(newValue);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, onChange],
  );

  const onTriggerKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
    },
    [],
  );

  const onListKey = useCallback(
    (e: KeyboardEvent<HTMLUListElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          for (let j = 1; j <= options.length; j++) {
            const next = (i + j) % options.length;
            if (!options[next]?.disabled) return next;
          }
          return i;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          for (let j = 1; j <= options.length; j++) {
            const next = (i - j + options.length) % options.length;
            if (!options[next]?.disabled) return next;
          }
          return i;
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = options.findIndex((o) => !o.disabled);
        if (first >= 0) setActiveIndex(first);
      } else if (e.key === "End") {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i]?.disabled) {
            setActiveIndex(i);
            break;
          }
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt && !opt.disabled) commit(opt.value);
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    },
    [activeIndex, options, commit],
  );

  return (
    <div className={cn("relative", className)}>
      {/* Hidden input keeps native form submission working unchanged. */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        id={buttonId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex w-full items-center gap-2 text-left text-[color:var(--color-ink)] outline-none transition-colors",
          // Variant chrome
          variant === "default" &&
            "h-12 rounded-[var(--radius-sm)] border bg-[color:var(--color-surface)] px-3 text-base",
          variant === "compact" &&
            "h-10 rounded-[var(--radius-sm)] border bg-[color:var(--color-surface)] px-3 text-sm",
          variant === "bare" && "h-auto bg-transparent",
          // Open / hover ring (only on bordered variants)
          (variant === "default" || variant === "compact") &&
            (open
              ? "border-[color:var(--color-brand)] ring-2 ring-[color:var(--color-brand)]/15"
              : "border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]/40"),
          triggerTextClassName,
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {icon && (
          <span className="shrink-0 text-[color:var(--color-ink-soft)]">
            {icon}
          </span>
        )}
        <span
          className={cn(
            "flex-1 truncate",
            !selectedOption && "text-[color:var(--color-ink-soft)]",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[color:var(--color-ink-soft)] transition-transform",
            open && "rotate-180 text-[color:var(--color-brand)]",
          )}
          aria-hidden="true"
        />
      </button>

      {open && mounted &&
        createPortal(
          <>
            {/* Mobile backdrop */}
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-[color:var(--color-ink)]/40 anim-fade md:hidden"
            />

            {/* Panel — bottom sheet on mobile, anchored popover on desktop.
                Portaled out of the trigger's DOM so no ancestor's overflow,
                stacking context, or transform (e.g. our hero animation) can
                push it back into document flow. Desktop coords come from the
                measured `triggerRect`; mobile uses bottom-sheet fixed coords. */}
            <div
              className={cn(
                "z-[70] overflow-hidden bg-[color:var(--color-surface)] shadow-press anim-rise-soft",
                // Mobile bottom sheet (default)
                "fixed inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border-t-2 border-[color:var(--color-ink)]",
                // Desktop popover — clear bottom-sheet positioning + apply
                // measured viewport coords via CSS custom properties.
                "md:inset-auto md:bottom-auto md:top-[var(--cs-top)] md:left-[var(--cs-left)] md:min-w-[var(--cs-min-w)]",
                "md:max-h-80 md:max-w-md md:rounded-2xl md:border md:border-[color:var(--color-hairline)] md:border-t-2 md:border-t-[color:var(--color-ink)]",
              )}
              style={
                triggerRect
                  ? ({
                      "--cs-top": `${triggerRect.bottom + 8}px`,
                      "--cs-left": `${triggerRect.left}px`,
                      "--cs-min-w": `${triggerRect.width}px`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {/* Mobile-only header with title + close */}
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-5 py-3 md:hidden">
                <span className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
                  {ariaLabel ?? placeholder}
                </span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-[color:var(--color-hairline)] text-[color:var(--color-ink)]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                tabIndex={-1}
                aria-activedescendant={
                  activeIndex >= 0 ? `${buttonId}-opt-${activeIndex}` : undefined
                }
                onKeyDown={onListKey}
                className="max-h-[calc(80vh-4rem)] overflow-y-auto py-1 outline-none md:max-h-72"
              >
                {options.map((opt, i) => {
                  const isSelected = opt.value === value;
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={`${opt.value}-${i}`}
                      id={`${buttonId}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      data-idx={i}
                      onMouseEnter={() =>
                        !opt.disabled && setActiveIndex(i)
                      }
                      onClick={() => {
                        if (!opt.disabled) commit(opt.value);
                      }}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-between gap-3 border-l-2 border-transparent px-4 py-2.5 text-sm transition-colors",
                        isActive &&
                          !opt.disabled &&
                          "border-l-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]",
                        isSelected &&
                          "font-medium text-[color:var(--color-brand-strong)]",
                        opt.disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.hint && (
                          <span className="mt-0.5 block truncate text-xs text-[color:var(--color-ink-soft)]">
                            {opt.hint}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check
                          className="size-4 shrink-0 text-[color:var(--color-brand)]"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
