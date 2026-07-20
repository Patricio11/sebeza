"use client";

import { useMemo, useState, useTransition } from "react";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { TextField, SelectField } from "@/components/ui/FormField";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { DatePicker } from "@/components/ui/DatePicker";
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
import { validateDob } from "@/lib/auth/id-validation";
import { COUNTRIES, flagEmoji } from "@/lib/taxonomy/countries";

interface ProfessionOption {
  slug: string;
  label: string;
}
import {
  CONSENT_PURPOSES,
  REQUIRED_FOR_SEARCHABILITY,
  type ConsentPurpose,
} from "@/lib/consent";
import { signUpSeeker, acceptSeekerInvitation } from "@/lib/auth/actions";
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

/**
 * Phase 11.4.4 follow-up  the two messaging-channel purposes are
 * deliberately EXCLUDED from sign-up. Per D2 the seeker grants them
 * from /dashboard/account alongside phone verification  asking for
 * SMS/WhatsApp consent before a phone number even exists on file is
 * premature, and the dispatch layer multi-gates on verified phone +
 * allowlist anyway. The consents state map still carries all 8 keys
 * (the two excluded ones simply stay false and no row is written).
 * This filter is also what keeps the step-2 render inside the
 * `auth.seekerSignUp.step2.purposes` en.json catalog  the messaging
 * purposes have no sign-up label by design (their consent copy lives
 * on the privacy centre + PhoneChannelPanel where it has context).
 */
const SIGN_UP_CONSENT_PURPOSES = CONSENT_PURPOSES.filter(
  (p) => p !== "messaging_channel_sms" && p !== "messaging_channel_whatsapp",
);

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
  // Phase 13.1  optional current-context fields.
  // currentModulesText: free-text comma- or newline-separated input;
  // we split + dedupe at submit time so the form state stays simple
  // (no chip-input client island at sign-up; that's the editor's job).
  currentModulesText: string;
  electiveChosen: string;
  projectTopic: string;
}

interface FormState {
  step: Step;
  // Step 1
  fullName: string;
  email: string;
  phone: string;
  /** ISO yyyy-mm-dd. Captured at sign-up for the 14100 age gate and
   *  LMI youth-cohort analytics. ID / passport numbers are NOT
   *  collected here  too much friction before the user has even
   *  seen the product. They get added later from the profile editor
   *  + uploaded for KYC review from the dashboard's KYC panel
   *  (Phase 9.16, follow-up: 2026-05-27 trim). */
  dateOfBirth: string;
  /** Phase 31 ("Data minimisation", amended 2026-07-20)  the primary
   *  question is the two-class citizen Yes/No (defaults to Yes; ~99% of
   *  users are South African). HYBRID: answering No reveals the country
   *  picker  nationality displays on the public profile + search rows,
   *  so for non-citizens we still capture WHICH country. Analytics +
   *  ranking read only the flag; never a gate. */
  isCitizen: boolean;
  /** ISO alpha-2 code; only relevant (and required) when isCitizen=false. */
  nationality: string;
  password: string;
  passwordConfirm: string;
  // Step 2
  consents: Record<ConsentPurpose, boolean>;
  // Step 3
  profession: string;
  province: string;
  status: "open_to_work" | "employed" | "self_employed" | "studying" | "unemployed";
  /** Phase 7.5  optional work-availability set captured at sign-up. */
  workAvailability: (
    | "casual"
    | "part_time"
    | "contract"
    | "full_time"
    | "remote"
    | "hybrid"
    // Phase 9.21  recurring calendar-window work.
    | "seasonal"
  )[];
  academic: AcademicState;
  /**
   * Phase 9.22  current employment block (optional, only renders
   * when status is employed / self_employed). The combobox value is
   * either an existing org id (picked from the dropdown) OR a free-
   * text name (Other mode). On submit, we check `employerOptions` to
   * disambiguate the two paths.
   */
  currentEmployerValue: string;
  currentEmployerCity: string;
  currentRoleStartedYear: string;
  currentRoleStartedMonth: string;
  currentRoleCity: string;
}

const initialState: FormState = {
  step: 1,
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  isCitizen: true,
  nationality: "",
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
    // Phase 13.1
    currentModulesText: "",
    electiveChosen: "",
    projectTopic: "",
  },
  // Phase 9.22  current-employment defaults (empty; the block only
  // renders when status is employed / self_employed).
  currentEmployerValue: "",
  currentEmployerCity: "",
  currentRoleStartedYear: "",
  currentRoleStartedMonth: "",
  currentRoleCity: "",
};

interface Props {
  /** DB-backed list; falls back to MOCK_PROFESSIONS if absent. */
  professions?: ProfessionOption[];
  /**
   * Phase 9.22  picker-visible orgs for the employer combobox in step
   * 3. Server-fetched + passed in so the form doesn't need to do a
   * round-trip on mount. Empty falls back to "Other only" mode.
   */
  employerOptions?: ReadonlyArray<{
    id: string;
    name: string;
    city: string | null;
    badge: "sebenza_registered" | "seeker_named_verified";
    listedBySeekerCount: number;
  }>;
  /**
   * Phase 9.17  pre-fill data + token from an employer-initiated
   * invitation. When present:
   *   - name + email are pre-filled in step 1; email is disabled
   *     (the invite row is the source of truth for which address
   *     becomes the new account's email)
   *   - profession is pre-filled in step 3 if the inviter selected one
   *   - submit calls `acceptSeekerInvitation` with the token instead
   *     of the public `signUpSeeker`
   * When absent the form behaves identically to the public sign-up.
   */
  invitationContext?: {
    token: string;
    orgName: string;
    prefilledEmail: string;
    prefilledName: string | null;
    prefilledProfession: string | null;
  };
}

/** sessionStorage key for the public seeker sign-up draft. */
const DRAFT_KEY = "sebenza:seeker-signup-draft";

type PersistableFormState = Omit<FormState, "password" | "passwordConfirm">;

export function SeekerSignUpForm({
  professions,
  invitationContext,
  employerOptions,
}: Props = {}) {
  const router = useRouter();
  const PROFESSIONS = professions && professions.length > 0 ? professions : MOCK_PROFESSIONS;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(() => {
    if (!invitationContext) return initialState;
    return {
      ...initialState,
      fullName: invitationContext.prefilledName ?? "",
      email: invitationContext.prefilledEmail,
      profession: invitationContext.prefilledProfession ?? "",
    };
  });
  const t = useTranslations("auth.seekerSignUp");
  const tCommon = useTranslations("auth.common");
  const tStatus = useTranslations("status");
  const tPurposes = useTranslations("auth.seekerSignUp.step2.purposes");

  // Build the persistable slice fresh each render. Passwords are
  // NEVER included  even though sessionStorage is tab-scoped, the
  // smaller surface area for credentials is a real win.
  const persistable: PersistableFormState = useMemo(
    () => ({
      step: state.step,
      fullName: state.fullName,
      email: state.email,
      phone: state.phone,
      dateOfBirth: state.dateOfBirth,
      isCitizen: state.isCitizen,
      nationality: state.nationality,
      consents: state.consents,
      profession: state.profession,
      province: state.province,
      status: state.status,
      workAvailability: state.workAvailability,
      academic: state.academic,
      // Phase 9.22  draft-persist the employment block so a locale
      // switch mid-form doesn't wipe it.
      currentEmployerValue: state.currentEmployerValue,
      currentEmployerCity: state.currentEmployerCity,
      currentRoleStartedYear: state.currentRoleStartedYear,
      currentRoleStartedMonth: state.currentRoleStartedMonth,
      currentRoleCity: state.currentRoleCity,
    }),
    [state],
  );

  const { clear: clearDraft } = useSessionDraft<PersistableFormState>(
    DRAFT_KEY,
    {
      state: persistable,
      onRestore: (draft) => {
        setState((s) => {
          const merged: FormState = {
            ...s,
            ...draft,
            password: "",
            passwordConfirm: "",
          };
          // Re-overlay invitation-locked fields if present so a stale
          // public draft can't override the invite's authoritative
          // email/name/profession pre-fills.
          if (invitationContext) {
            merged.fullName =
              invitationContext.prefilledName ?? merged.fullName;
            merged.email = invitationContext.prefilledEmail;
            if (invitationContext.prefilledProfession) {
              merged.profession = invitationContext.prefilledProfession;
            }
          }
          return merged;
        });
      },
    },
  );

  function goto(step: Step) {
    setState((s) => ({ ...s, step }));
    setError(null);
  }

  function step1Valid() {
    if (state.fullName.trim().length < 2) return false;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.email)) return false;
    if (!validateDob(state.dateOfBirth).ok) return false;
    // Phase 31 hybrid  non-citizens must pick their country (it displays
    // on the profile + search rows).
    if (!state.isCitizen && state.nationality.length !== 2) return false;
    if (state.password.length < 10) return false;
    if (state.password !== state.passwordConfirm) return false;
    if (scorePassword(state.password).score < 2) return false;
    return true;
  }

  // Inline DOB validation message  shown only after the user has
  // typed something, so the form doesn't shout "invalid" the instant
  // it opens.
  const dobError = state.dateOfBirth
    ? !validateDob(state.dateOfBirth).ok
      ? (validateDob(state.dateOfBirth) as { ok: false; message: string })
          .message
      : undefined
    : undefined;

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
      // Phase 9.22  resolve the employer block. The combobox value is
      // either an existing org id (matches an entry in employerOptions)
      // OR a free-text Other name. Only relevant when status is
      // employed / self_employed; otherwise everything is NULL.
      const opts = employerOptions ?? [];
      const employerIsPicked = opts.some(
        (o) => o.id === state.currentEmployerValue,
      );
      const employerBlock =
        state.status === "employed" || state.status === "self_employed"
          ? {
              currentEmployerOrgId: employerIsPicked
                ? state.currentEmployerValue
                : null,
              customCurrentEmployerName:
                !employerIsPicked && state.currentEmployerValue.trim()
                  ? state.currentEmployerValue.trim()
                  : undefined,
              customCurrentEmployerCity:
                !employerIsPicked &&
                state.currentEmployerValue.trim() &&
                state.currentEmployerCity.trim()
                  ? state.currentEmployerCity.trim()
                  : undefined,
              currentRoleStartedAt:
                state.currentRoleStartedYear && state.currentRoleStartedMonth
                  ? `${state.currentRoleStartedYear}-${state.currentRoleStartedMonth.padStart(2, "0")}-01`
                  : null,
              currentRoleCity: state.currentRoleCity.trim() || null,
            }
          : {};

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
            // Phase 13.1  parse current-modules free-text into a
            // deduped array. Split on commas or newlines so seekers
            // can paste in whatever shape they have it.
            currentModules: Array.from(
              new Set(
                state.academic.currentModulesText
                  .split(/[,\n]/)
                  .map((m) => m.trim())
                  .filter((m) => m.length > 0),
              ),
            ).slice(0, 8),
            electiveChosen: state.academic.electiveChosen.trim() || null,
            projectTopic: state.academic.projectTopic.trim() || null,
          }
        : null;

      const result = invitationContext
        ? await acceptSeekerInvitation({
            token: invitationContext.token,
            fullName: state.fullName,
            phone: state.phone || undefined,
            dateOfBirth: state.dateOfBirth,
            isCitizen: state.isCitizen,
            ...(state.isCitizen ? {} : { nationality: state.nationality }),
            password: state.password,
            grantedConsents,
            profession: state.profession,
            province: state.province,
            status: state.status,
            workAvailability: state.workAvailability,
            academic,
          })
        : await signUpSeeker({
            fullName: state.fullName,
            email: state.email,
            phone: state.phone || undefined,
            dateOfBirth: state.dateOfBirth,
            isCitizen: state.isCitizen,
            ...(state.isCitizen ? {} : { nationality: state.nationality }),
            password: state.password,
            grantedConsents,
            profession: state.profession,
            province: state.province,
            status: state.status,
            workAvailability: state.workAvailability,
            academic,
            // Phase 9.22  current-employment block. NULL for non-
            // employed / non-self-employed statuses.
            ...employerBlock,
          });

      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Successful sign-up  wipe the draft so the next visitor on
      // this tab doesn't inherit half-typed data.
      clearDraft();
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
              disabled={pending || Boolean(invitationContext)}
              hint={
                invitationContext
                  ? "Locked to the address your invitation was sent to."
                  : undefined
              }
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
          {/* Phase 9.16  Date of birth captured separately so we can run
              the 14100 age gate independently of the ID kind, and so
              the SA ID prefix can be cross-checked against it. */}
          <DatePicker
            id="dateOfBirth"
            label="Date of birth"
            value={state.dateOfBirth}
            onChange={(v) => setState({ ...state, dateOfBirth: v })}
            minDate={`${new Date().getUTCFullYear() - 100}-01-01`}
            maxDate={(() => {
              // Latest allowed = today minus 14 years (SA Basic Conditions
              // of Employment minimum). Computed once per render.
              const d = new Date();
              const yyyy = d.getUTCFullYear() - 14;
              const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
              const dd = String(d.getUTCDate()).padStart(2, "0");
              return `${yyyy}-${mm}-${dd}`;
            })()}
            helpText="Used to confirm your age and (for SA IDs) to verify your number."
            error={dobError}
            disabled={pending}
          />

          {/* Phase 31 ("Data minimisation")  the 191-country picker is
              gone: the only nationality signal Sebenza uses is the
              two-class citizen split, so that's all we ask. One Yes/No,
              plain language, lowest possible friction for a nervous
              first-time user. Never a gate  the help text says so. */}
          <fieldset disabled={pending}>
            <legend className="text-sm font-medium text-[color:var(--color-ink)]">
              {t("step1.citizenQuestion")}
            </legend>
            <div
              role="radiogroup"
              aria-label={t("step1.citizenQuestion")}
              className="mt-2 inline-flex rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-0.5"
            >
              {(
                [
                  { value: true, label: t("step1.citizenYes") },
                  { value: false, label: t("step1.citizenNo") },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.label}
                  className={`cursor-pointer rounded-[var(--radius-pill)] px-5 py-1.5 text-sm transition-colors ${
                    state.isCitizen === opt.value
                      ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                      : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="isCitizen"
                    className="sr-only"
                    checked={state.isCitizen === opt.value}
                    onChange={() =>
                      setState({ ...state, isCitizen: opt.value })
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[color:var(--color-ink-soft)]">
              {t("step1.citizenHelp")}
            </p>
          </fieldset>

          {/* Phase 31 hybrid (operator feedback 2026-07-20)  answering No
              reveals the country picker: nationality displays on the
              public profile + search rows, so for non-citizens we still
              capture WHICH country. ZA is excluded ("not a citizen but
              from South Africa" is contradictory  flip the toggle
              instead). Citizens never see this. */}
          {!state.isCitizen && (
            <ComboboxField
              id="nationality"
              label={t("step1.nationalityLabel")}
              value={state.nationality}
              onChange={(v) => setState({ ...state, nationality: v })}
              options={COUNTRIES.filter((c) => c.code !== "ZA").map((c) => ({
                value: c.code,
                label: c.label,
                leading: flagEmoji(c.code),
              }))}
              placeholder="Search countries…"
              helpText={t("step1.nationalityHelp")}
              required
              disabled={pending}
            />
          )}
          <div className="flex flex-col gap-1">
            <PasswordField
              id="password"
              label={tCommon("password")}
              value={state.password}
              onChange={(e) => setState({ ...state, password: e.target.value })}
              autoComplete="new-password"
              required
              hint="At least 10 characters. Mix letters, digits and symbols."
              disabled={pending}
            />
            <PasswordStrengthMeter password={state.password} />
          </div>
          <PasswordField
            id="passwordConfirm"
            label="Confirm password"
            value={state.passwordConfirm}
            onChange={(e) =>
              setState({ ...state, passwordConfirm: e.target.value })
            }
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
            {SIGN_UP_CONSENT_PURPOSES.map((purpose) => {
              const required = REQUIRED_FOR_SEARCHABILITY.includes(purpose);
              // Per-purpose onboarding explainer (D8 source text for
              // vacancy_matching). Whitelist  not every purpose gets a
              // sub-paragraph; the short label is enough for the
              // already-familiar ones. Added at 9.8.3 because Sebenza
              // had not previously asked seekers for invite-channel
              // consent and a one-line label can't carry the lawful
              // basis. Renders as a tap-to-expand `<details>` on
              // mobile, always visible on md+  same pattern as the
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

          {/* Phase 9.22  current-employment block. Only renders when
              status is employed or self_employed. All fields optional. */}
          {(state.status === "employed" ||
            state.status === "self_employed") && (
            <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
              <legend className="px-1 font-display text-base">
                Where do you work?
              </legend>
              <p className="mb-4 text-xs text-[color:var(--color-ink-soft)]">
                Optional. Tells employers searching the platform where
                you&rsquo;re currently placed + grows the platform&rsquo;s
                employer database honestly. Pick from the list, or use
                Other to add a new employer (admin reviews these before
                they appear in the picker for others).
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <ComboboxField
                  id="current-employer"
                  label="Current employer"
                  value={state.currentEmployerValue}
                  onChange={(v) =>
                    setState({ ...state, currentEmployerValue: v })
                  }
                  options={(employerOptions ?? []).map((o) => ({
                    value: o.id,
                    label: o.name,
                    subLabel:
                      o.badge === "sebenza_registered"
                        ? "Sebenza employer"
                        : o.listedBySeekerCount === 1
                          ? "Listed by 1 seeker"
                          : `Listed by ${o.listedBySeekerCount} seekers`,
                  }))}
                  placeholder="Search employers"
                  allowOther
                  otherLabel="My employer isn't listed"
                />
                {/* City input only when Other is in effect (free-text
                    value that doesn't match any option). */}
                {state.currentEmployerValue.trim().length > 0 &&
                  !(employerOptions ?? []).some(
                    (o) => o.id === state.currentEmployerValue,
                  ) && (
                    <TextField
                      id="current-employer-city"
                      label="Employer city"
                      placeholder="e.g. Sandton"
                      value={state.currentEmployerCity}
                      onChange={(e) =>
                        setState({
                          ...state,
                          currentEmployerCity: e.target.value,
                        })
                      }
                    />
                  )}
                <SelectField
                  id="role-started-month"
                  label="Started (month)"
                  value={state.currentRoleStartedMonth}
                  onChange={(e) =>
                    setState({
                      ...state,
                      currentRoleStartedMonth: e.target.value,
                    })
                  }
                >
                  <option value=""></option>
                  {[
                    [1, "January"],
                    [2, "February"],
                    [3, "March"],
                    [4, "April"],
                    [5, "May"],
                    [6, "June"],
                    [7, "July"],
                    [8, "August"],
                    [9, "September"],
                    [10, "October"],
                    [11, "November"],
                    [12, "December"],
                  ].map(([n, label]) => (
                    <option key={n} value={String(n)}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  id="role-started-year"
                  label="Started (year)"
                  value={state.currentRoleStartedYear}
                  onChange={(e) =>
                    setState({
                      ...state,
                      currentRoleStartedYear: e.target.value,
                    })
                  }
                >
                  <option value=""></option>
                  {Array.from({ length: 40 }, (_, i) => {
                    const y = new Date().getFullYear() - i;
                    return (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    );
                  })}
                </SelectField>
                <TextField
                  id="role-city"
                  label="City you work in"
                  placeholder="e.g. Cape Town  leave blank to use your home city"
                  value={state.currentRoleCity}
                  onChange={(e) =>
                    setState({ ...state, currentRoleCity: e.target.value })
                  }
                />
              </div>
            </fieldset>
          )}

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

                  {/* Phase 13.1  current-semester context. All three
                      optional. Modules input is a single textarea
                      (comma / newline separated)  no chip-input client
                      island at sign-up; the editor handles the richer
                      capture path. */}
                  <div className="md:col-span-2 mt-2 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4">
                    <div className="mb-3 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      Current studies (optional)
                    </div>
                    <TextField
                      id="academic-modules"
                      label="Modules this semester"
                      placeholder="Operating Systems, Database Systems, Algorithms"
                      hint="Comma- or newline-separated; up to 8."
                      value={state.academic.currentModulesText}
                      onChange={(e) =>
                        setState({
                          ...state,
                          academic: {
                            ...state.academic,
                            currentModulesText: e.target.value,
                          },
                        })
                      }
                    />
                    {Number(state.academic.currentYear) >= 2 && (
                      <div className="mt-3">
                        <TextField
                          id="academic-elective"
                          label="Elective you chose"
                          placeholder="e.g. Cloud Computing"
                          hint="One elective  the one that excites you most."
                          value={state.academic.electiveChosen}
                          onChange={(e) =>
                            setState({
                              ...state,
                              academic: {
                                ...state.academic,
                                electiveChosen: e.target.value.slice(0, 100),
                              },
                            })
                          }
                        />
                      </div>
                    )}
                    {Number(state.academic.currentYear) >= 3 && (
                      <div className="mt-3">
                        <TextField
                          id="academic-project"
                          label="Project / dissertation topic"
                          placeholder="e.g. Anomaly detection in IoT sensor streams"
                          hint={`Single sentence; up to 200 chars (${state.academic.projectTopic.length}/200).`}
                          value={state.academic.projectTopic}
                          onChange={(e) =>
                            setState({
                              ...state,
                              academic: {
                                ...state.academic,
                                projectTopic: e.target.value.slice(0, 200),
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Work-availability  visible to every seeker (not just students).
              Originally inside the student panel as the "while I study"
              path; lifted out 2026-05-26 so non-students can declare
              their availability at sign-up too. The data layer + server
              action already support this for any seeker. */}
          <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
            <legend className="px-1 text-xs font-medium text-[color:var(--color-ink)]">
              Available for (optional)
            </legend>
            <p className="mt-1 mb-3 text-xs text-[color:var(--color-ink-soft)]">
              What kinds of work you&rsquo;re open to. Independent of your
              current status  e.g. an employed person can also be open to
              contract work. You can change this any time from your dashboard.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["casual", "Casual / shift work"],
                  // Phase 9.21  position between casual and part_time
                  // groups the "non-traditional employment patterns"
                  // together (casual / seasonal / remote / hybrid).
                  ["seasonal", "Seasonal"],
                  ["part_time", "Part-time"],
                  ["contract", "Contract"],
                  ["full_time", "Full-time"],
                  ["remote", "Remote"],
                  ["hybrid", "Hybrid"],
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
          </fieldset>

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
