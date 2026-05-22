"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tCommon = useTranslations("auth.common");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    startTransition(async () => {
      // Anti-enumeration: always shows the success state regardless.
      await requestPasswordReset({ email });
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-6">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          Check your inbox
        </div>
        <p className="mt-2 text-[color:var(--color-ink)]">
          If an account exists for that email, we&apos;ve sent a reset link.
          It&apos;s good for one hour. Be sure to check spam.
        </p>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
        >
          ← {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <TextField
        id="email"
        name="email"
        label={tCommon("email")}
        type="email"
        autoComplete="email"
        required
        disabled={pending}
      />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Sending…" : t("submit")}
      </Button>
      <Link
        href="/sign-in"
        className="text-sm text-[color:var(--color-brand)] hover:underline"
      >
        ← {t("back")}
      </Link>
    </form>
  );
}
