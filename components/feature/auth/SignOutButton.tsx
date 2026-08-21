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
      onClick={() =>
        startTransition(async () => {
          // Deliberately NOT a Server Action. An action's response
          // includes a re-render of the CURRENT page, and re-rendering
          // a protected page whose session the action just destroyed is
          // what 500'd on production (digest 2790868036, /dashboard/
          // profile, Vercel only). The action succeeded, its re-render
          // crashed, the client saw a throw, and the user stayed on an
          // error boundary while actually signed out.
          //
          // The plain REST endpoint has no re-render step: it clears
          // the cookie and returns JSON, and then we hard-navigate,
          // which also drops every cached RSC payload for the dead
          // session. Sign-out must be the most reliable button in the
          // product, so it gets the dumbest possible transport.
          let restWorked = false;
          try {
            const r = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
              credentials: "same-origin",
            });
            restWorked = r.ok;
          } catch {
            // fall through to the action
          }
          if (!restWorked) {
            // Second belt: the Server Action. It revokes the session
            // reliably; what crashes is the page re-render streamed
            // back AFTER, which is why the await is wrapped: a throw
            // here means "the render failed", not "you are still
            // signed in", and it must never strand the user on an
            // error boundary mid-sign-out.
            try {
              await signOut();
            } catch {
              // Session state is now unknown; the hard navigation
              // below resolves it honestly either way.
            }
          }
          window.location.assign("/");
        })
      }
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
