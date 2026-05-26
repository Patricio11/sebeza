"use client";

/**
 * Sebenza Checkbox  reusable Civic Editorial control.
 *
 * Replaces every bare <input type="checkbox"> in the system. Standard
 * shape: label + optional description + visual checkmark + native
 * input (visually hidden, kept for a11y + form submission). The
 * entire label area is the click target  no more "the box is too
 * small to hit" problem.
 *
 * Visual contract:
 *   - Unchecked: 2px ink-soft border on paper background
 *   - Hover: border darkens to ink
 *   - Checked: ink fill + paper-coloured SVG checkmark (no OS-native
 *             checkmark; consistent across browsers)
 *   - Indeterminate: ink fill + horizontal bar (parent-checkbox
 *                    pattern for tri-state filters)
 *   - Focus-visible: brand-tint ring (keyboard users see it; mouse
 *                    users don't, per the focus-visible spec)
 *   - Disabled: 60% opacity + cursor-not-allowed
 *
 * Sizes:
 *   - md (default): 16×16 box, 14px label, 12px description
 *   - sm:            14×14 box, 13px label, 11px description
 *
 * Accessibility:
 *   - Native <input> stays in the DOM (hidden via .sr-only) so
 *     screen readers + form submissions + autofill all work
 *   - <label htmlFor> wraps both visual + text  click anywhere
 *     toggles
 *   - Indeterminate set via useEffect on the input ref
 *   - aria-describedby links to description text when present
 */

import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  /** Controlled checked state. */
  checked: boolean;
  /** Called with the NEW checked value (boolean), not the event.
   *  Simpler than the native onChange(e) → e.target.checked dance. */
  onChange: (checked: boolean) => void;
  /** Visible label. Required for accessibility. */
  label: ReactNode;
  /** Optional muted-tone helper text under the label. */
  description?: ReactNode;
  /** Disable input + style. */
  disabled?: boolean;
  /** Tri-state indeterminate (parent-of-children filter pattern). */
  indeterminate?: boolean;
  /** Size variant. Default: md. */
  size?: "sm" | "md";
  /** Vertical alignment of the box vs the label. Default: start. */
  align?: "start" | "center";
  /** Form-submission name. Pass when used inside an uncontrolled <form>. */
  name?: string;
  /** Explicit DOM id (auto-generated if omitted). */
  id?: string;
  /** Extra className for the outer wrapper. */
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  indeterminate,
  size = "md",
  align = "start",
  name,
  id,
  className,
}: Props) {
  const reactId = useId();
  const inputId = id ?? `cb-${reactId}`;
  const descId = description ? `${inputId}-desc` : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  // Indeterminate isn't expressible via HTML attribute alone  set imperatively.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !!indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  const boxSize = size === "sm" ? "size-3.5" : "size-4";
  const checkSize = size === "sm" ? "size-2.5" : "size-3";
  const labelText = size === "sm" ? "text-[0.8rem]" : "text-sm";
  const descText = size === "sm" ? "text-[0.65rem]" : "text-xs";
  const gap = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <label
      htmlFor={inputId}
      className={
        "group flex " +
        (align === "center" ? "items-center " : "items-start ") +
        gap +
        " " +
        (disabled
          ? "cursor-not-allowed opacity-60 "
          : "cursor-pointer ") +
        (className ?? "")
      }
    >
      {/* Hidden but a11y-real native input. Toggled by the label click. */}
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={descId}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      {/* Visual box */}
      <span
        aria-hidden="true"
        className={
          "relative flex shrink-0 items-center justify-center rounded-[3px] border-2 transition-colors " +
          (align === "start" && size === "md" ? "mt-0.5 " : "") +
          (align === "start" && size === "sm" ? "mt-[3px] " : "") +
          boxSize +
          " " +
          (checked || indeterminate
            ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
            : "border-[color:var(--color-ink-soft)] bg-[color:var(--color-paper)] group-hover:border-[color:var(--color-ink)]") +
          " peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--color-brand)]/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[color:var(--color-paper)]"
        }
      >
        {checked && !indeterminate && (
          <svg viewBox="0 0 12 12" className={checkSize} aria-hidden="true">
            <path
              d="M2 6.5 5 9.5 10 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {indeterminate && !checked && (
          <span
            aria-hidden="true"
            className="block h-0.5 w-2 rounded-full bg-[color:var(--color-paper)]"
          />
        )}
      </span>
      {/* Label + optional description */}
      <span className="min-w-0 flex-1">
        <span
          className={
            labelText +
            " text-[color:var(--color-ink)] " +
            (size === "md" ? "leading-snug" : "leading-tight")
          }
        >
          {label}
        </span>
        {description && (
          <span
            id={descId}
            className={
              "mt-0.5 block " +
              descText +
              " text-[color:var(--color-ink-soft)]"
            }
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
