"use client";

/**
 * Phase 7 (Task 7.2) — the "two-factor" panel on /account.
 *
 * If 2FA is on, exposes a Disable form (password-confirmed). If off,
 * routes the user to /setup-2fa to enrol.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { disableTwoFactor } from "@/lib/auth/two-factor";

interface Props {
  enabled: boolean;
  enforced: boolean;
}

export function TwoFactorAccountPanel({ enabled, enforced }: Props) {
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await disableTwoFactor({ password });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      window.location.reload();
    });
  }

  if (enabled) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Two-factor is on
        </div>
        <div className="mt-1 font-display text-2xl">Active</div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          TOTP via authenticator app. Every sign-in requires your 6-digit code
          or one of your remaining backup codes.
        </p>

        {!showDisable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setShowDisable(true)}
          >
            Disable two-factor
          </Button>
        ) : (
          <form onSubmit={submitDisable} className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-[color:var(--color-ink-soft)]">
              Confirm your password to turn 2FA off.
              {enforced && (
                <>
                  {" "}
                  Note: 2FA is currently enforced for your role — you will be
                  asked to re-enrol immediately.
                </>
              )}
            </p>
            <TextField
              id="disable-pw"
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 py-2 text-sm text-[color:var(--color-danger)]"
              >
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={pending}>
                {pending ? "Working…" : "Confirm disable"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDisable(false);
                  setPassword("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-5">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Two-factor is off
      </div>
      <div className="mt-1 font-display text-2xl">
        {enforced ? "Required" : "Recommended"}
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
        {enforced
          ? "Sebenza requires 2FA for your role. Set it up now to unlock the rest of your workspace."
          : "A 6-digit code from your authenticator app keeps your account safe even if your password is exposed."}
      </p>
      <Link
        href="/setup-2fa"
        className="mt-4 inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
      >
        Set up two-factor →
      </Link>
    </div>
  );
}
