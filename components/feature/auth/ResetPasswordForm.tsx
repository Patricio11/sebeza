"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { completePasswordReset } from "@/lib/auth/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    startTransition(async () => {
      const result = await completePasswordReset({ token, newPassword });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/sign-in" as never);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      )}
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        required
        hint="At least 10 characters."
        disabled={pending}
      />
      <PasswordField
        id="confirm"
        name="confirm"
        label="Confirm new password"
        autoComplete="new-password"
        required
        disabled={pending}
      />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Setting…" : "Set new password"}
      </Button>
    </form>
  );
}
