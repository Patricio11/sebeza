"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import {
  PasswordStrengthMeter,
  scorePassword,
} from "@/components/ui/PasswordStrength";
import { signUpEmployer } from "@/lib/auth/actions";

const INDUSTRY_OPTIONS = [
  "Financial services",
  "Hospitality",
  "Construction",
  "Healthcare",
  "Information technology",
  "Manufacturing",
  "Retail",
  "Mining",
  "Public sector",
] as const;
const INDUSTRY_OTHER = "Other";

export function EmployerSignUpForm() {
  const router = useRouter();
  const t = useTranslations("auth.employerSignUp");
  const tCommon = useTranslations("auth.common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Controlled fields needed for conditional / cross-field UI.
  const [industry, setIndustry] = useState<string>("");
  const [industryOther, setIndustryOther] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordConfirm, setPasswordConfirm] = useState<string>("");

  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;
  const passwordStrong = scorePassword(password).score >= 2;
  const submitBlocked =
    pending ||
    passwordMismatch ||
    !passwordStrong ||
    password.length < 10 ||
    (industry === INDUSTRY_OTHER && industryOther.trim().length < 2);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // When the user picked "Other", the real industry is the free-text input.
    const resolvedIndustry =
      industry === INDUSTRY_OTHER ? industryOther.trim() : industry;
    const data = {
      orgName: String(fd.get("orgName") ?? ""),
      registrationNumber: String(fd.get("registrationNumber") ?? ""),
      industry: resolvedIndustry,
      size: String(fd.get("size") ?? ""),
      country: String(fd.get("country") ?? "South Africa"),
      fullName: String(fd.get("fullName") ?? ""),
      yourRole: String(fd.get("yourRole") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      password,
    };

    if (passwordMismatch) {
      setError("Passwords don't match.");
      return;
    }
    if (!passwordStrong) {
      setError("Please choose a stronger password (10+ chars, mix of letters / digits / symbols).");
      return;
    }

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
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">Select…</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={INDUSTRY_OTHER}>{INDUSTRY_OTHER}</option>
          </SelectField>
        </div>
        {industry === INDUSTRY_OTHER && (
          <TextField
            id="industryOther"
            name="industryOther"
            label="Industry  please specify"
            placeholder="e.g. Renewable energy"
            value={industryOther}
            onChange={(e) => setIndustryOther(e.target.value)}
            required
            disabled={pending}
            hint="Two or more characters."
          />
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            id="size"
            name="size"
            label={t("size")}
            required
            disabled={pending}
          >
            <option value="">Select…</option>
            <option value="1-10">1 – 10</option>
            <option value="11-50">11 – 50</option>
            <option value="51-200">51 – 200</option>
            <option value="201-1000">201 – 1 000</option>
            <option value="1001+">1 001+</option>
          </SelectField>
          <SelectField
            id="country"
            name="country"
            label={t("country")}
            required
            defaultValue="South Africa"
            disabled={pending}
          >
            <option value="South Africa">South Africa</option>
            <option value="Other (operates in SA)">
              Other (operates in SA)
            </option>
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
        <div className="flex flex-col gap-1">
          <TextField
            id="password"
            name="password"
            label={tCommon("password")}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 10 characters. Mix letters, digits and symbols."
            disabled={pending}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <TextField
          id="passwordConfirm"
          name="passwordConfirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          error={passwordMismatch ? "Passwords don't match." : undefined}
          disabled={pending}
        />
      </section>

      <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
        Your organisation starts unverified. You can search talent immediately,
        but contact details and documents stay locked until verification is
        complete.
      </p>

      <Button type="submit" variant="primary" size="lg" disabled={submitBlocked}>
        {pending ? "Creating…" : t("submit")}
      </Button>
    </form>
  );
}
