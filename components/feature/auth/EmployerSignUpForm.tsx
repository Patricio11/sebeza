"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { TextField, SelectField } from "@/components/ui/FormField";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import {
  PasswordStrengthMeter,
  scorePassword,
} from "@/components/ui/PasswordStrength";
import { signUpEmployer } from "@/lib/auth/actions";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";

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

/** sessionStorage key for the in-flight employer sign-up draft. */
const DRAFT_KEY = "sebenza:employer-signup-draft";

interface FormFields {
  orgKind: string;
  orgName: string;
  registrationNumber: string;
  industry: string;
  industryOther: string;
  size: string;
  country: string;
  fullName: string;
  yourRole: string;
  email: string;
  phone: string;
}

const INITIAL: FormFields = {
  orgKind: "",
  orgName: "",
  registrationNumber: "",
  industry: "",
  industryOther: "",
  size: "",
  country: "South Africa",
  fullName: "",
  yourRole: "",
  email: "",
  phone: "",
};

export function EmployerSignUpForm() {
  const router = useRouter();
  const t = useTranslations("auth.employerSignUp");
  const tCommon = useTranslations("auth.common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFields>(INITIAL);
  // Password fields stay separate  they are NEVER persisted.
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
    (fields.industry === INDUSTRY_OTHER && fields.industryOther.trim().length < 2) ||
    (fields.orgKind !== "direct_employer" && fields.orgKind !== "recruitment_agency");

  // Persist + restore the non-sensitive fields. Passwords are
  // deliberately omitted from the draft slice  see the hook doc.
  const persistable = useMemo(() => fields, [fields]);
  const { clear: clearDraft } = useSessionDraft<FormFields>(DRAFT_KEY, {
    state: persistable,
    onRestore: (draft) => {
      setFields((f) => ({ ...f, ...draft }));
    },
  });

  function setField<K extends keyof FormFields>(k: K, v: FormFields[K]) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // When the user picked "Other", the real industry is the free-text input.
    const resolvedIndustry =
      fields.industry === INDUSTRY_OTHER
        ? fields.industryOther.trim()
        : fields.industry;
    const data = {
      orgKind: fields.orgKind as "direct_employer" | "recruitment_agency",
      orgName: fields.orgName,
      registrationNumber: fields.registrationNumber,
      industry: resolvedIndustry,
      size: fields.size,
      country: fields.country || "South Africa",
      fullName: fields.fullName,
      yourRole: fields.yourRole,
      email: fields.email,
      phone: fields.phone,
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
      clearDraft();
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
        {/* The first honest question (docs/RECRUITER_CLIENT_PLAN.md):
            agencies get client fields on every vacancy they create.
            Two big cards, not a dropdown - this choice shapes the whole
            workspace, so it deserves daylight (founder, 2026-08-22). */}
        <fieldset>
          <legend className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            {t("orgKind")}
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("orgKind")}>
            {(
              [
                {
                  value: "direct_employer",
                  title: t("orgKindDirect"),
                  desc: t("orgKindDirectDesc"),
                },
                {
                  value: "recruitment_agency",
                  title: t("orgKindAgency"),
                  desc: t("orgKindAgencyDesc"),
                },
              ] as const
            ).map((opt) => {
              const active = fields.orgKind === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={pending}
                  onClick={() => setField("orgKind", opt.value)}
                  className={
                    "rounded-[var(--radius-md)] border-2 p-4 text-left transition-colors " +
                    (active
                      ? "border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)]"
                      : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-ink)]")
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-base text-[color:var(--color-ink)]">
                      {opt.title}
                    </span>
                    <span
                      aria-hidden="true"
                      className={
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
                        (active
                          ? "border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-strong)]"
                          : "border-[color:var(--color-hairline)]")
                      }
                    >
                      {active && (
                        <span className="size-2 rounded-full bg-[color:var(--color-paper)]" />
                      )}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <TextField
          id="orgName"
          name="orgName"
          label={t("orgName")}
          required
          autoComplete="organization"
          value={fields.orgName}
          onChange={(e) => setField("orgName", e.target.value)}
          disabled={pending}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="registrationNumber"
            name="registrationNumber"
            label={t("registrationNumber")}
            placeholder="2020/123456/07"
            required
            value={fields.registrationNumber}
            onChange={(e) => setField("registrationNumber", e.target.value)}
            disabled={pending}
          />
          <SelectField
            id="industry"
            name="industry"
            label={t("industry")}
            required
            disabled={pending}
            value={fields.industry}
            onChange={(e) => setField("industry", e.target.value)}
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
        {fields.industry === INDUSTRY_OTHER && (
          <TextField
            id="industryOther"
            name="industryOther"
            label="Industry, please specify"
            placeholder="e.g. Renewable energy"
            value={fields.industryOther}
            onChange={(e) => setField("industryOther", e.target.value)}
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
            value={fields.size}
            onChange={(e) => setField("size", e.target.value)}
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
            value={fields.country}
            onChange={(e) => setField("country", e.target.value)}
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
            value={fields.fullName}
            onChange={(e) => setField("fullName", e.target.value)}
            disabled={pending}
          />
          <TextField
            id="yourRole"
            name="yourRole"
            label={t("yourRole")}
            placeholder="Head of People"
            required
            value={fields.yourRole}
            onChange={(e) => setField("yourRole", e.target.value)}
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
            value={fields.email}
            onChange={(e) => setField("email", e.target.value)}
            disabled={pending}
          />
          <TextField
            id="phone"
            name="phone"
            label={tCommon("phone")}
            type="tel"
            autoComplete="tel"
            value={fields.phone}
            onChange={(e) => setField("phone", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <PasswordField
            id="password"
            name="password"
            label={tCommon("password")}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 10 characters. Mix letters, digits and symbols."
            disabled={pending}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <PasswordField
          id="passwordConfirm"
          name="passwordConfirm"
          label="Confirm password"
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

      {/* The way back (founder, 2026-08-22): people land here already
          holding an account, and the page offered no door. */}
      <p className="text-center text-sm text-[color:var(--color-ink-soft)]">
        {t("alreadyHave")}{" "}
        <Link
          href="/sign-in"
          className="font-medium text-[color:var(--color-ink)] underline hover:text-[color:var(--color-brand-strong)]"
        >
          {t("signInLink")}
        </Link>
      </p>
    </form>
  );
}
