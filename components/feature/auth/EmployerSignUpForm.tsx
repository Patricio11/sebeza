"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { signUpEmployer } from "@/lib/auth/actions";

export function EmployerSignUpForm() {
  const router = useRouter();
  const t = useTranslations("auth.employerSignUp");
  const tCommon = useTranslations("auth.common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data = {
      orgName: String(fd.get("orgName") ?? ""),
      registrationNumber: String(fd.get("registrationNumber") ?? ""),
      industry: String(fd.get("industry") ?? ""),
      size: String(fd.get("size") ?? ""),
      country: String(fd.get("country") ?? "South Africa"),
      fullName: String(fd.get("fullName") ?? ""),
      yourRole: String(fd.get("yourRole") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      password: String(fd.get("password") ?? ""),
    };
    startTransition(async () => {
      const result = await signUpEmployer(data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(
        `/verify-email?email=${encodeURIComponent(data.email)}` as never,
      );
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

      <section className="flex flex-col gap-5">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          Organisation
        </div>
        <TextField
          id="orgName"
          name="orgName"
          label={t("orgName")}
          required
          autoComplete="organization"
          disabled={pending}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="registrationNumber"
            name="registrationNumber"
            label={t("registrationNumber")}
            placeholder="2020/123456/07"
            required
            disabled={pending}
          />
          <SelectField
            id="industry"
            name="industry"
            label={t("industry")}
            required
            disabled={pending}
          >
            <option value="">Select…</option>
            <option>Financial services</option>
            <option>Hospitality</option>
            <option>Construction</option>
            <option>Healthcare</option>
            <option>Information technology</option>
            <option>Manufacturing</option>
            <option>Retail</option>
            <option>Mining</option>
            <option>Public sector</option>
            <option>Other</option>
          </SelectField>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            id="size"
            name="size"
            label={t("size")}
            required
            disabled={pending}
          >
            <option value="">Select…</option>
            <option>1 – 10</option>
            <option>11 – 50</option>
            <option>51 – 200</option>
            <option>201 – 1 000</option>
            <option>1 001+</option>
          </SelectField>
          <SelectField
            id="country"
            name="country"
            label={t("country")}
            required
            defaultValue="South Africa"
            disabled={pending}
          >
            <option>South Africa</option>
            <option>Other (operates in SA)</option>
          </SelectField>
        </div>
      </section>

      <hr className="hairline" />

      <section className="flex flex-col gap-5">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          {t("youAs")}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="fullName"
            name="fullName"
            label={tCommon("fullName")}
            required
            autoComplete="name"
            disabled={pending}
          />
          <TextField
            id="yourRole"
            name="yourRole"
            label={t("yourRole")}
            placeholder="Head of People"
            required
            disabled={pending}
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="email"
            name="email"
            label={tCommon("email")}
            type="email"
            required
            autoComplete="email"
            disabled={pending}
          />
          <TextField
            id="phone"
            name="phone"
            label={tCommon("phone")}
            type="tel"
            autoComplete="tel"
            disabled={pending}
          />
        </div>
        <TextField
          id="password"
          name="password"
          label={tCommon("password")}
          type="password"
          autoComplete="new-password"
          required
          hint="At least 10 characters."
          disabled={pending}
        />
      </section>

      <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
        Your organisation starts unverified. You can search talent immediately,
        but contact details and documents stay locked until verification is
        complete.
      </p>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Creating…" : t("submit")}
      </Button>
    </form>
  );
}
