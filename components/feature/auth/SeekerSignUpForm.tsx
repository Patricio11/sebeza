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
      state.password.length >= 10
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
          <TextField
            id="password"
            label={tCommon("password")}
            value={state.password}
            onChange={(e) => setState({ ...state, password: e.target.value })}
            type="password"
            autoComplete="new-password"
            required
            hint="At least 10 characters."
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
              return (
                <li
                  key={purpose}
                  className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
                >
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={state.consents[purpose]}
                      disabled={required || pending}
                      onChange={(e) =>
                        setState({
                          ...state,
                          consents: {
                            ...state.consents,
                            [purpose]: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 size-4"
                    />
                    <span>
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
                    </span>
                  </label>
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
          <SelectField
            id="profession"
            label={t("step3.professionLabel")}
            value={state.profession}
            onChange={(e) =>
              setState({ ...state, profession: e.target.value })
            }
            required
          >
            <option value="">Select…</option>
            {PROFESSIONS.map((p) => (
              <option key={p.slug} value={p.label}>
                {p.label}
              </option>
            ))}
          </SelectField>
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

          {/* Student toggle */}
          <details
            open={state.academic.isStudent}
            className="group rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] open:border-solid open:bg-[color:var(--color-surface)]"
          >
            <summary className="flex cursor-pointer items-start gap-3 p-5 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
              <input
                type="checkbox"
                checked={state.academic.isStudent}
                onChange={(e) =>
                  setState({
                    ...state,
                    academic: {
                      ...state.academic,
                      isStudent: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 size-4"
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <GraduationCap
                    className="size-4 text-[color:var(--color-accent)]"
                    aria-hidden="true"
                  />
                  {t("step3.studentToggle")}
                </div>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {t("step3.studentToggleHint")}
                </p>
              </div>
            </summary>

            {state.academic.isStudent && (
              <div className="border-t border-[color:var(--color-hairline)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    id="academic-institution"
                    label={t("step3.academic.institutionLabel")}
                    value={state.academic.institutionSlug}
                    onChange={(e) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          institutionSlug: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {INSTITUTIONS.map((i) => (
                      <option key={i.slug} value={i.slug}>
                        {i.label}
                      </option>
                    ))}
                  </SelectField>
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
                  <TextField
                    id="academic-graduation"
                    label={t("step3.academic.graduationLabel")}
                    type="month"
                    value={state.academic.expectedGraduation}
                    onChange={(e) =>
                      setState({
                        ...state,
                        academic: {
                          ...state.academic,
                          expectedGraduation: e.target.value,
                        },
                      })
                    }
                  />
                  <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      checked={state.academic.nsfas}
                      onChange={(e) =>
                        setState({
                          ...state,
                          academic: {
                            ...state.academic,
                            nsfas: e.target.checked,
                          },
                        })
                      }
                      className="size-4"
                    />
                    {t("step3.academic.nsfasLabel")}
                  </label>
                  <label className="inline-flex items-start gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      checked={state.academic.openToInternships}
                      onChange={(e) =>
                        setState({
                          ...state,
                          academic: {
                            ...state.academic,
                            openToInternships: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 size-4"
                    />
                    <span>{t("step3.academic.openToInternships")}</span>
                  </label>
                  <label className="inline-flex items-start gap-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      checked={state.academic.openToGraduateProgrammes}
                      onChange={(e) =>
                        setState({
                          ...state,
                          academic: {
                            ...state.academic,
                            openToGraduateProgrammes: e.target.checked,
                          },
                        })
                      }
                      className="mt-1 size-4"
                    />
                    <span>
                      {t("step3.academic.openToGraduateProgrammes")}
                    </span>
                  </label>

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
                            <label className="flex items-start gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? Array.from(new Set([...state.workAvailability, kind]))
                                    : state.workAvailability.filter((v) => v !== kind);
                                  setState({ ...state, workAvailability: next });
                                }}
                                className="mt-0.5 size-4"
                              />
                              <span>{label}</span>
                            </label>
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
          </details>

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
