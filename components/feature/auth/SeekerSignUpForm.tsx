"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  TextField,
  SelectField,
  EncryptedBadge,
} from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { Checkbox } from "@/components/ui/Checkbox";
import { ComboboxField } from "@/components/ui/ComboboxField";
import {
  PasswordStrengthMeter,
  scorePassword,
} from "@/components/ui/PasswordStrength";
import {
  PROVINCES,
  PROFESSIONS as MOCK_PROFESSIONS,
  INSTITUTIONS,
  NQF_LEVELS,
} from "@/lib/mock/taxonomy";

interface ProfessionOption {
  slug: string;
  label: string;
}
import {
  CONSENT_PURPOSES,
  REQUIRED_FOR_SEARCHABILITY,
  type ConsentPurpose,
} from "@/lib/consent";
import { signUpSeeker } from "@/lib/auth/actions";
import { GraduationCap } from "lucide-react";

type Step = 1 | 2 | 3;

/**
 * Phase 9.8.3  per-purpose onboarding explainer (D8 source text for
 * `vacancy_matching`). Whitelist  not every purpose gets a sub-
 * paragraph; the short tPurposes() label is enough for familiar ones.
 * Kept here (not in en.json) because next-intl's namespaced `t()` would
 * throw on missing keys for the entries we deliberately don't fill in;
 * a sparse Partial<Record> keyed by purpose is cleaner. The text
 * itself stays a verbatim copy of D8 in PHASE_9_8_PLAN.md so the
 * onboarding + privacy-centre + plan doc never drift.
 */
const PURPOSE_ONBOARDING_EXPLAINER: Partial<Record<ConsentPurpose, string>> = {
  vacancy_matching:
    "When you grant this, verified employers can flag you for a specific role they're trying to fill  a chef position at a particular restaurant, a developer role at a particular bank. You'll get a notification with the role + employer named, and you can accept, decline, or decline with a reason. Declining is free. You can revoke this consent any time from your privacy centre, and declining a single invite doesn't hurt your visibility in search.",
};

interface AcademicState {
  isStudent: boolean;
  institutionSlug: string;
  programme: string;
  fieldOfStudy: string;
  nqfLevel: number;
  currentYear: string; // "" | "1" | "2" | ...
  expectedGraduation: string;
  nsfas: boolean;
  openToInternships: boolean;
  openToGraduateProgrammes: boolean;
}

interface FormState {
  step: Step;
  // Step 1
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  password: string;
  passwordConfirm: string;
  // Step 2
  consents: Record<ConsentPurpose, boolean>;
  // Step 3
  profession: string;
  province: string;
  status: "open_to_work" | "employed" | "self_employed" | "studying" | "unemployed";
  /** Phase 7.5  optional work-availability set captured at sign-up. */
  workAvailability: ("casual" | "part_time" | "contract" | "full_time")[];
  academic: AcademicState;
}

const initialState: FormState = {
  step: 1,
  fullName: "",
  email: "",
  phone: "",
  nationalId: "",
  password: "",
  passwordConfirm: "",
  consents: Object.fromEntries(
    CONSENT_PURPOSES.map((p) => [p, REQUIRED_FOR_SEARCHABILITY.includes(p)]),
  ) as Record<ConsentPurpose, boolean>,
  profession: "",
  province: "",
  status: "open_to_work",
  workAvailability: [],
  academic: {
    isStudent: false,
    institutionSlug: "",
    programme: "",
    fieldOfStudy: "",
    nqfLevel: 7,
    currentYear: "",
    expectedGraduation: "",
    nsfas: false,
    openToInternships: true,
    openToGraduateProgrammes: true,
  },
};

interface Props {
  /** DB-backed list; falls back to MOCK_PROFESSIONS if absent. */
  professions?: ProfessionOption[];
}

export function SeekerSignUpForm({ professions }: Props = {}) {
  const router = useRouter();
  const PROFESSIONS = professions && professions.length > 0 ? professions : MOCK_PROFESSIONS;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(initialState);
  const t = useTranslations("auth.seekerSignUp");
  const tCommon = useTranslations("auth.common");
  const tStatus = useTranslations("status");
  const tPurposes = useTranslations("auth.seekerSignUp.step2.purposes");

  function goto(step: Step) {
    setState((s) => ({ ...s, step }));
    setError(null);
  }

  function step1Valid() {
    return (
      state.fullName.trim().length >= 2 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.email) &&
      state.nationalId.length >= 6 &&
      state.password.length >= 10 &&
      state.password === state.passwordConfirm &&
      scorePassword(state.password).score >= 2
    );
  }

  function step3Valid() {
    return Boolean(state.profession && state.province && state.status);
  }

  function onSubmitFinal() {
    if (!step3Valid()) {
      setError("Please pick a profession, province, and status.");
      return;
    }
    const grantedConsents = CONSENT_PURPOSES.filter(
      (p) => state.consents[p],
    ) as ConsentPurpose[];
    if (!REQUIRED_FOR_SEARCHABILITY.every((p) => grantedConsents.includes(p))) {
      setError("Searchability consent is required.");
      goto(2);
      return;
    }

    startTransition(async () => {
      const academic = state.academic.isStudent
        ? {
            institutionSlug: state.academic.institutionSlug,
            programme: state.academic.programme,
            fieldOfStudy: state.academic.fieldOfStudy,
            nqfLevel: state.academic.nqfLevel,
            currentYear: state.academic.currentYear
              ? Number(state.academic.currentYear)
              : null,
            expectedGraduation: state.academic.expectedGraduation,
            nsfas: state.academic.nsfas,
            openToInternships: state.academic.openToInternships,
            openToGraduateProgrammes: state.academic.openToGraduateProgrammes,
          }
        : null;

      const result = await signUpSeeker({
        fullName: state.fullName,
        email: state.email,
        phone: state.phone || undefined,
        nationalId: state.nationalId,
        password: state.password,
        grantedConsents,
        profession: state.profession,
        province: state.province,
        status: state.status,
        workAvailability: state.workAvailability,
        academic,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(
        `/verify-email?email=${encodeURIComponent(state.email)}` as never,
      );
    });
  }

  return (
    <>
      <Stepper current={state.step} />

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      )}

      {state.step === 1 && (
        <div className="flex flex-col gap-6">
          <TextField
            id="fullName"
            label={tCommon("fullName")}
            value={state.fullName}
            onChange={(e) => setState({ ...state, fullName: e.target.value })}
            autoComplete="name"
            required
            hint={t("stepHints.name")}
            disabled={pending}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              id="email"
              label={tCommon("email")}
              value={state.email}
              onChange={(e) => setState({ ...state, email: e.target.value })}
              type="email"
              autoComplete="email"
              required
              disabled={pending}
            />
            <TextField
              id="phone"
              label={tCommon("phone")}
              value={state.phone}
              onChange={(e) => setState({ ...state, phone: e.target.value })}
              type="tel"
              autoComplete="tel"
              placeholder="+27 …"
              disabled={pending}
            />
          </div>
          <TextField
            id="nationalId"
            label="South African ID number (or passport)"
            value={state.nationalId}
            onChange={(e) =>
              setState({ ...state, nationalId: e.target.value })
            }
            required
            badge={<EncryptedBadge />}
            hint={t("stepHints.id")}
            disabled={pending}
          />
          <div className="flex flex-col gap-1">
            <TextField
              id="password"
              label={tCommon("password")}
              value={state.password}
              onChange={(e) => setState({ ...state, password: e.target.value })}
              type="password"
              autoComplete="new-password"
              required
              hint="At least 10 characters. Mix letters, digits and symbols."
              disabled={pending}
            />
            <PasswordStrengthMeter password={state.password} />
          </div>
          <TextField
            id="passwordConfirm"
            label="Confirm password"
            value={state.passwordConfirm}
            onChange={(e) =>
              setState({ ...state, passwordConfirm: e.target.value })
            }
            type="password"
            autoComplete="new-password"
            required
            error={
              state.passwordConfirm.length > 0 &&
              state.password !== state.passwordConfirm
                ? "Passwords don't match."
                : undefined
            }
            disabled={pending}
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!step1Valid()}
            onClick={() => goto(2)}
          >
            {t("step1.next")}
          </Button>
        </div>
      )}

      {state.step === 2 && (
        <div className="flex flex-col gap-6">
          <ul className="space-y-3">
            {CONSENT_PURPOSES.map((purpose) => {
              const required = REQUIRED_FOR_SEARCHABILITY.includes(purpose);
              // Per-purpose onboarding explainer (D8 source text for
              // vacancy_matching). Whitelist  not every purpose gets a
              // sub-paragraph; the short label is enough for the
              // already-familiar ones. Added at 9.8.3 because Sebenza
              // had not previously asked seekers for invite-channel
              // consent and a one-line label can't carry the lawful
              // basis. Renders as a tap-to-expand `<details>` on
              // mobile, always visible on md+ — same pattern as the
              // /dashboard/privacy explainer.
              const explainer = PURPOSE_ONBOARDING_EXPLAINER[purpose];
              return (
                <li
                  key={purpose}
                  className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
                >
                  <Checkbox
                    checked={state.consents[purpose]}
                    disabled={required || pending}
                    onChange={(v) =>
                      setState({
                        ...state,
                        consents: {
                          ...state.consents,
                          [purpose]: v,
                        },
                      })
                    }
                    label={
                      <>
                        <span className="font-medium text-[color:var(--color-ink)]">
                          {tPurposes(purpose)}
                        </span>
                        {required && (
                          <span className="ml-2 inline-block rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                            Required
                          </span>
                        )}
                        {required && (
                          <span className="mt-1 block text-xs text-[color:var(--color-ink-soft)]">
                            {t("step2.required")}
                          </span>
                        )}
                        {explainer && (
                          <>
                            <details className="mt-2 text-xs text-[color:var(--color-ink-soft)] md:hidden">
                              <summary className="cursor-pointer select-none rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)]">
                                Read the full explainer
                              </summary>
                              <p className="mt-2">{explainer}</p>
                            </details>
                            <span className="mt-2 hidden text-xs text-[color:var(--color-ink-soft)] md:block">
                              {explainer}
                            </span>
                          </>
                        )}
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
          <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
            Granted consents are stored with the version of the consent text
            you saw and the timestamp. You can revoke any of them from your
            privacy centre at any time.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => goto(1)}
              disabled={pending}
            >
              ← Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => goto(3)}
              disabled={pending}
            >
              {t("step2.next")}
            </Button>
          </div>
        </div>
      )}

      {state.step === 3 && (
        <div className="flex flex-col gap-6">
          <ComboboxField
            id="profession"
            label={t("step3.professionLabel")}
            value={state.profession}
            onChange={(v) => setState({ ...state, profession: v })}
            options={PROFESSIONS.map((p) => ({ value: p.label }))}
            placeholder="Search professions…"
            required
            allowOther
            otherLabel="My profession isn't listed"
          />
          <SelectField
            id="province"
            label={t("step3.locationLabel")}
            value={state.province}
            onChange={(e) =>
              setState({ ...state, province: e.target.value })
            }
            required
          >
            <option value="">Select…</option>
            {PROVINCES.map((p) => (
              <option key={p.slug} value={p.label}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="status"
            label={t("step3.statusLabel")}
            value={state.status}
            onChange={(e) =>
              setState({
                ...state,
                status: e.target.value as FormState["status"],
              })
            }
            required
          >
            {(
              [
                "open_to_work",
                "employed",
                "self_employed",
                "studying",
                "unemployed",
              ] as const
            ).map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </SelectField>

          {/* Student toggle  the whole card-header is one button so
              clicking anywhere (icon, label, hint, the checkbox visual
              itself) toggles `isStudent` AND opens/closes the panel
              in one go. Previously this was a <details>/<summary>
              pair that let the panel open without flipping the
              checkbox state  desync bug. */}
          <div
            className={
              "rounded-[var(--radius-md)] border-2 " +
              (state.academic.isStudent
                ? "border-solid border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
                : "border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)]")
            }
          >
            <button
              type="button"
              aria-expanded={state.academic.isStudent}
              onClick={() =>
                setState({
                  ...state,
                  academic: {
                    ...state.academic,
                    isStudent: !state.academic.isStudent,
                  },
                })
              }
              className="flex w-full cursor-pointer items-start gap-3 rounded-[var(--radius-md)] p-5 text-left text-sm hover:bg-[color:var(--color-paper)]/50"
            >
              <span
                aria-hidden="true"
                className={
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 transition-colors " +
                  (state.academic.isStudent
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                    : "border-[color:var(--color-ink-soft)] bg-[color:var(--color-paper)]")
                }
              >
                {state.academic.isStudent && (
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                    <path
                      d="M2 6.5 5 9.5 10 3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium">
                  <GraduationCap
                    className="size-4 text-[color:var(--color-accent)]"
                    aria-hidden="true"
                  />
                  {t("step3.studentToggle")}
                </span>
                <span className="mt-1 block text-xs text-[color:var(--color-ink-soft)]">
                  {t("step3.studentToggleHint")}
                </span>
              </span>
            </button>

            {state.academic.isStudent && (
              <div className="border-t border-[color:var(--color-hairline)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <ComboboxField
                    id="academic-institution"
                    label={t("step3.academic.institutionLabel")}
                    value={state.academic.institutionSlug}
                    onChange={(v) =>
                      setState({
                        ...state,
                        academic: { ...state.academic, institutionSlug: v },
                      })
                    }
                    options={INSTITUTIONS.map((i) => ({
                      value: i.slug,
                      label: i.label,
                    }))}
                    placeholder="Search institutions…"
                    allowOther
                    otherLabel="My institution isn't listed"
                  />
                  <TextField
                    id="academic-programme"
                    label={t("step3.academic.programmeLabel")}
                    placeholder="e.g. BSc Computer Science"
                    value={state.academic.programme}
                    onChange={(e) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          programme: e.target.value,
                        },
                      })
                    }
                  />
                  <TextField
                    id="academic-field"
                    label={t("step3.academic.fieldLabel")}
                    placeholder="e.g. Computer Science"
                    value={state.academic.fieldOfStudy}
                    onChange={(e) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          fieldOfStudy: e.target.value,
                        },
                      })
                    }
                  />
                  <SelectField
                    id="academic-nqf"
                    label={t("step3.academic.nqfLabel")}
                    value={String(state.academic.nqfLevel)}
                    onChange={(e) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          nqfLevel: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {NQF_LEVELS.map((n) => (
                      <option key={n.level} value={n.level}>
                        {n.label} · {n.band}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    id="academic-year"
                    label={t("step3.academic.yearLabel")}
                    value={state.academic.currentYear}
                    onChange={(e) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          currentYear: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {[1, 2, 3, 4, 5].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </SelectField>
                  <MonthYearPicker
                    id="academic-graduation"
                    label={t("step3.academic.graduationLabel")}
                    value={state.academic.expectedGraduation}
                    onChange={(value) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          expectedGraduation: value,
                        },
                      })
                    }
                  />
                  <Checkbox
                    className="md:col-span-2"
                    align="center"
                    checked={state.academic.nsfas}
                    onChange={(v) =>
                      setState({
                        ...state,
                        academic: { ...state.academic, nsfas: v },
                      })
                    }
                    label={t("step3.academic.nsfasLabel")}
                  />
                  <Checkbox
                    className="md:col-span-2"
                    checked={state.academic.openToInternships}
                    onChange={(v) =>
                      setState({
                        ...state,
                        academic: { ...state.academic, openToInternships: v },
                      })
                    }
                    label={t("step3.academic.openToInternships")}
                  />
                  <Checkbox
                    className="md:col-span-2"
                    checked={state.academic.openToGraduateProgrammes}
                    onChange={(v) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          openToGraduateProgrammes: v,
                        },
                      })
                    }
                    label={t("step3.academic.openToGraduateProgrammes")}
                  />

                  {/* Phase 7.5  work-availability while studying. The casual /
                      part-time path: students taking shifts (waitressing,
                      retail, etc.) for income now, not deferred to graduation. */}
                  <fieldset className="mt-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] p-3">
                    <legend className="px-1 text-xs font-medium">
                      Available for work while I study (optional)
                    </legend>
                    <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["casual", "Casual / shift work"],
                          ["part_time", "Part-time"],
                          ["contract", "Contract"],
                          ["full_time", "Full-time"],
                        ] as const
                      ).map(([kind, label]) => {
                        const checked = state.workAvailability.includes(kind);
                        return (
                          <li key={kind}>
                            <Checkbox
                              size="sm"
                              checked={checked}
                              onChange={(v) => {
                                const next = v
                                  ? Array.from(new Set([...state.workAvailability, kind]))
                                  : state.workAvailability.filter((x) => x !== kind);
                                setState({ ...state, workAvailability: next });
                              }}
                              label={label}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-[0.65rem] italic text-[color:var(--color-ink-soft)]">
                      You can change this any time from your dashboard.
                    </p>
                  </fieldset>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => goto(2)}
              disabled={pending}
            >
              ← Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onSubmitFinal}
              disabled={pending || !step3Valid()}
            >
              {pending ? "Creating…" : t("step3.next")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="mb-8 flex items-center gap-2">
      {[1, 2, 3].map((n) => {
        const isActive = n === current;
        const isPast = n < current;
        return (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={
                "flex size-7 items-center justify-center rounded-full border text-xs font-display tabular " +
                (isActive
                  ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                  : isPast
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-paper)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]")
              }
            >
              {n}
            </span>
            {n < 3 && (
              <span
                aria-hidden="true"
                className={
                  "h-px flex-1 " +
                  (isPast
                    ? "bg-[color:var(--color-brand)]"
                    : "bg-[color:var(--color-hairline)]")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
