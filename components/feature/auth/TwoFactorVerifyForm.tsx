"use client";

/**
 * Phase 7 (Task 7.2) — /verify-2fa form (sign-in step 2).
 *
 * Two modes: TOTP (default) and backup-code (link toggles). Both
 * Server Actions return the post-success path so we can navigate
 * client-side without an extra round-trip.
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { ShieldCheck, KeyRound } from "lucide-react";
import { verifyBackupCode, verifyTotp } from "@/lib/auth/two-factor";

interface Props {
  next?: string;
}

export function TwoFactorVerifyForm({ next }: Props) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res =
        mode === "totp"
          ? await verifyTotp({ code, next })
          : await verifyBackupCode({ code, next });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Hard-redirect so the freshly minted session is picked up by
      // the next render (rather than relying on router cache).
      window.location.assign(res.next);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
        {mode === "totp" ? (
          <>
            <ShieldCheck
              className="size-4 text-[color:var(--color-brand)]"
              aria-hidden="true"
            />
            Enter the 6-digit code from your authenticator app.
          </>
        ) : (
          <>
            <KeyRound
              className="size-4 text-[color:var(--color-accent)]"
              aria-hidden="true"
            />
            Enter one of your unused backup codes. Each code is single-use.
          </>
        )}
      </div>

      <TextField
        id="verify-code"
        label={mode === "totp" ? "6-digit code" : "Backup code"}
        type="text"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(e) =>
          setCode(
            mode === "totp"
              ? e.target.value.replace(/\D/g, "").slice(0, 6)
              : e.target.value.trim().slice(0, 32),
          )
        }
        {...(mode === "totp"
          ? { inputMode: "numeric" as const, pattern: "[0-9]{6}", maxLength: 6 }
          : { maxLength: 32 })}
      />

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 py-2 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "totp" ? "backup" : "totp"));
          setCode("");
          setError(null);
        }}
        className="text-left text-xs uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
      >
        {mode === "totp"
          ? "Use a backup code instead →"
          : "← Use my authenticator app"}
      </button>
    </form>
  );
}
