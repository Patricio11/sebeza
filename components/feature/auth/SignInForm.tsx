"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { signIn } from "@/lib/auth/actions";

interface Props {
  /** ?next=/some-path  preserved across the sign-in roundtrip. */
  next?: string;
}

/**
 * Sign-in form. Email + password only  role is identified server-side from
 * `app_user.role` and the redirect happens after Better Auth verifies
 * credentials. No role chip (was theatre + a quiet enumeration vector).
 */
export function SignInForm({ next }: Props) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    startTransition(async () => {
      const result = await signIn({ email, password, next });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // The action returns the correct destination (role-routed or `?next=` honoured).
      router.push(result.next as never);
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

      <TextField
        id="email"
        label={t("common.email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.co.za"
        disabled={pending}
      />

      <TextField
        id="password"
        label={t("common.password")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        disabled={pending}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
          <input
            type="checkbox"
            name="remember"
            className="size-4 rounded border-[color:var(--color-hairline)]"
            disabled={pending}
          />
          {t("common.rememberMe")}
        </label>
        <Link
          href="/forgot-password"
          className="text-[color:var(--color-brand)] hover:underline"
        >
          {t("signIn.forgot")}
        </Link>
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Signing in…" : t("signIn.submit")}
      </Button>

      <p className="text-sm text-[color:var(--color-ink-soft)]">
        {t("signIn.noAccount")}{" "}
        <Link
          href="/sign-up"
          className="font-medium text-[color:var(--color-brand)] hover:underline"
        >
          {t("signIn.createOne")}
        </Link>
      </p>
    </form>
  );
}
