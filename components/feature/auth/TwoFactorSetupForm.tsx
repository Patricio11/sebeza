"use client";

/**
 * Phase 7 (Task 7.2) — /setup-2fa flow.
 *
 * Three stages, all on one page:
 *   1. password       — confirm current password to unlock the secret
 *   2. show-codes     — display the otpauth URL + backup codes; user
 *                       scans the QR and saves the codes
 *   3. verify         — verify the first TOTP code so the plugin
 *                       flips two_factor_enabled = true
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { Copy, ShieldCheck } from "lucide-react";
import {
  confirmTwoFactor,
  enableTwoFactor,
} from "@/lib/auth/two-factor";

interface Props {
  email: string;
  postSetupHref: string;
}

type Stage = "password" | "show-codes" | "verify";

export function TwoFactorSetupForm({ email, postSetupHref }: Props) {
  const [stage, setStage] = useState<Stage>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await enableTwoFactor({ password });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setTotpURI(res.totpURI);
      setBackupCodes(res.backupCodes);
      setStage("show-codes");
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await confirmTwoFactor({ code });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Hard-redirect so the next render picks up the fresh session
      // with two_factor_enabled = true (cleared from the cookie cache).
      window.location.assign(postSetupHref);
    });
  }

  if (stage === "password") {
    return (
      <form onSubmit={submitPassword} className="flex flex-col gap-5">
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Confirm your password to generate a TOTP secret and backup codes for
          <span className="font-medium text-[color:var(--color-ink)]"> {email}</span>.
        </p>
        <TextField
          id="setup-pw"
          label="Current password"
          type="password"
          required
          minLength={10}
          autoComplete="current-password"
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
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Working…" : "Continue"}
        </Button>
      </form>
    );
  }

  if (stage === "show-codes") {
    const qrSrc =
      totpURI &&
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&data=${encodeURIComponent(totpURI)}`;
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-display text-xl">1. Scan in your authenticator</h2>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            Google Authenticator, 1Password, Authy — any TOTP app works.
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-white p-5 md:flex-row md:items-start">
            {qrSrc && (
              <img
                src={qrSrc}
                alt="Scan this QR with your authenticator app"
                width={220}
                height={220}
                className="rounded-[var(--radius-sm)]"
              />
            )}
            <div className="flex-1 break-all text-xs text-[color:var(--color-ink-soft)]">
              <span className="block text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                Or paste this URI manually
              </span>
              <code className="mt-1 block whitespace-pre-wrap font-mono">
                {totpURI}
              </code>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl">2. Save your backup codes</h2>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            One-time use. Store them in your password manager —{" "}
            <strong>we will never show them again</strong>.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-white p-4 md:grid-cols-5">
            {backupCodes.map((c) => (
              <code
                key={c}
                className="rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-2 py-1.5 text-center font-mono text-xs"
              >
                {c}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(backupCodes.join("\n"))}
            className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
          >
            <Copy className="size-3.5" aria-hidden="true" /> Copy all codes
          </button>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => {
            setStage("verify");
            setError(null);
          }}
        >
          I have saved my codes — continue
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submitCode} className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
        <ShieldCheck className="size-4 text-[color:var(--color-brand)]" aria-hidden="true" />
        Enter the 6-digit code your app is showing right now.
      </div>
      <TextField
        id="setup-code"
        label="6-digit code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
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
        {pending ? "Verifying…" : "Verify & finish setup"}
      </Button>
    </form>
  );
}
