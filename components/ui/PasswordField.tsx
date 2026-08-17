"use client";

/**
 * House password input: the standard TextField chrome plus an eye toggle
 * to reveal/hide what's typed (founder request, 2026-08-17). The toggle
 * is a real button (keyboard + screen-reader reachable), labelled from
 * the `auth.common.showPassword` / `hidePassword` catalog keys, and it
 * never changes the input's name/autocomplete so password managers and
 * the E2E suite's `input[type="password"]` selectors keep working on
 * initial render.
 *
 * Composes FieldShell directly (rather than wrapping TextField) so the
 * toggle centres on the input itself and stays put when a hint or error
 * line appears underneath.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell } from "@/components/ui/FormField";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
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
  const t = useTranslations("auth.common");
  const [visible, setVisible] = useState(false);

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
          type={visible ? "text" : "password"}
          className={cn(
            "h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 pr-12 text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]",
            error && "border-[color:var(--color-danger)]",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1.5 my-auto flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:var(--color-surface-sunk)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)]"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden="true" />
          ) : (
            <Eye className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </FieldShell>
  );
}
