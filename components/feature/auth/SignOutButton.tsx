"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "ghost" | "danger";
  label?: string;
  /** Hide the text label visually, keep it as sr-only for screen readers. */
  iconOnly?: boolean;
  className?: string;
}

export function SignOutButton({
  variant = "ghost",
  label = "Sign out",
  iconOnly = false,
  className,
}: Props) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full text-sm font-medium transition-colors",
        iconOnly ? "size-10 justify-center" : "px-5 py-2.5",
        variant === "ghost"
          ? "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]"
          : "border border-[color:var(--color-danger)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-white",
        pending && "opacity-60",
        className,
      )}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {iconOnly ? (
        <span className="sr-only">{pending ? "Signing out…" : label}</span>
      ) : (
        <span>{pending ? "Signing out…" : label}</span>
      )}
    </button>
  );
}
