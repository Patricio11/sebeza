"use client";

/**
 * Password input with a built-in show / hide eye toggle.
 *
 * Lives in its own file (not folded into FormField.tsx) because the
 * eye toggle needs `useState`  if FormField became a client
 * component, every page that renders a TextField (including server
 * pages like /privacy, /paia) would gain an unnecessary client
 * boundary. PasswordField is "use client"; TextField stays
 * server-friendly.
 *
 * Same prop shape as TextField except `type` is locked  the toggle
 * flips it between "password" and "text" internally.
 *
 * Accessibility:
 *   - aria-label on the toggle reflects current state
 *   - aria-pressed marks the toggle as a toggle button
 *   - tabIndex={-1} so a Tab from the input goes to the next form
 *     field rather than the eye icon (keyboard users almost never
 *     need the toggle  showing a password by accident is the
 *     more common harm than not being able to reach the icon)
 *   - autocomplete attributes pass straight through from the caller
 */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell } from "@/components/ui/FormField";

interface Props
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  error?: string;
  optional?: boolean;
}

export function PasswordField({
  id,
  label,
  hint,
  badge,
  error,
  optional,
  className,
  ...props
}: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      badge={badge}
      error={error}
      optional={optional}
    >
      <div className="relative">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          className={cn(
            // pr-11 leaves room for the toggle button; everything else
            // matches TextField's input styling 1:1.
            "h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] pl-3 pr-11 text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]",
            error && "border-[color:var(--color-danger)]",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          tabIndex={-1}
          className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:var(--color-surface-sunk)] hover:text-[color:var(--color-ink)]"
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </FieldShell>
  );
}
