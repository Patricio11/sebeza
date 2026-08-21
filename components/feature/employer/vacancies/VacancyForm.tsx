"use client";

/**
 * Phase 9.8.1  Shared create / edit vacancy form (client island).
 *
 * Mobile-first: single-column on phones, two-column grid on `md+`.
 * Forms render cleanly at 360px wide. Salary input has a clear PRIVATE
 * pill and the helper text reminds the editor it stays private.
 *
 * The form is generic over create vs edit  caller supplies the
 * `onSubmit` handler that wraps the Server Action (createVacancy or
 * updateVacancy). The component knows nothing about routing.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  TextField,
  TextareaField,
  SelectField,
} from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { MultiSelectComboboxField } from "@/components/ui/MultiSelectComboboxField";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { Lock } from "lucide-react";
import { PROFESSION_SKILLS_MAP } from "@/lib/mock/taxonomy";
import type {
  TaxonomyEntry,
  Province,
  SeasonalWindow,
  WorkAvailabilityKind,
} from "@/lib/mock/types";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";
import { useTranslations } from "next-intl";

export interface VacancyFormValue {
  title: string;
  professionSlug: string;
  /**
   * Phase 13.9  NULL = "Any province (remote / hybrid)". Only legal
   * when `workAvailability` includes `remote` or `hybrid`; server
   * action validation refuses otherwise. The form's `province`
   * picker auto-clears the "Any" choice when the user toggles off
   * both remote AND hybrid (D6).
   */
  provinceSlug: string | null;
  citySlug?: string | null;
  skillSlugs: string[];
  seniority?: string | null;
  salaryBand?: string | null;
  description?: string | null;
  documentsRequired: string[];
  inviteExpiryDays?: number | null;
  /** Phase 29.1  optional headcount. NULL = unspecified (never fabricated). */
  positions?: number | null;
  /** Phase 9.19  empty array = no constraint (matcher ignores axis). */
  workAvailability: WorkAvailabilityKind[];
  /** Phase 9.19  NULL = no constraint (matcher does NOT check this axis). */
  minYearsExperience?: number | null;
  /** Phase 9.19  NULL = no NQF check at all (every seeker passes). */
  minNqfLevel?: number | null;
  /** Phase 9.19 D8  opt-in 7-day follow-up nudge cron (default off). */
  followUpNudgesEnabled?: boolean;
  /** Phase 34  Self Apply public link (default off; first enable
   *  mints the token server-side). */
  selfApplyEnabled?: boolean;
  /** Phase 34 D2  show salary band to signed-in applicants (default
   *  on; anonymous visitors never see it regardless). */
  salaryVisibleToApplicants?: boolean;
  /** Phase 9.21  vacancy-side season window. Flat fields rather than
   *  a nested object so the form value matches the Zod schema in
   *  `vacancies.ts` 1:1 (the server action accepts these three fields
   *  directly). NULL clears the column; the action layer's pairing
   *  guard ensures both months are NULL when one is. Read shapes
   *  (VacancyRow.seasonalWindow) use the nested object  the form
   *  accepts either via the widened `initial` prop. */
  seasonalWindowStartMonth?: number | null;
  seasonalWindowEndMonth?: number | null;
  seasonalWindowStartYear?: number | null;
  seasonalWindowEndYear?: number | null;
  seasonalWindowRecurringAnnually?: boolean | null;
}

export interface VacancyFormProps {
  /**
   * Optional preset values. Accepts either the flat form shape OR the
   * nested `seasonalWindow` object that `VacancyRow` carries  the
   * detail-page edit flow passes the row directly, and we don't want
   * every call site to manually unwrap. The form reads from whichever
   * shape is present.
   */
  initial?: Partial<VacancyFormValue> & {
    seasonalWindow?: SeasonalWindow | null;
  };
  professions: TaxonomyEntry[];
  provinces: Province[];
  skills: TaxonomyEntry[];
  /** Server Action wrapper. Returns the result to surface errors. */
  onSubmit: (
    value: VacancyFormValue,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** Where to navigate on success. */
  redirectTo: string;
  /** Submit button label. Defaults to the translated "Save vacancy". */
  submitLabel?: string;
  /** Cancel button href. Defaults to /employer/vacancies. */
  cancelHref?: string;
  /**
   * Scopes the sessionStorage draft key so drafts don't bleed between
   * vacancies. Pass the vacancy id when editing; defaults to "new" for
   * the create flow. Without this, opening Edit-A then Edit-B would
   * make B inherit A's unsaved draft.
   */
  draftId?: string;
  /**
   * Phase 34  platform flag `feature_flag_vacancy_self_apply`,
   * resolved server-side. While false the Self Apply section doesn't
   * render at all (ship-dark); the server action ignores the fields
   * regardless, so this is purely a rendering gate.
   */
  selfApplyFeatureOn?: boolean;
}

interface VacancyDraft {
  title: string;
  profession: string;
  province: string;
  seniority: string;
  salaryBand: string;
  description: string;
  inviteExpiryDays: string;
  /** Phase 29.1  headcount as a form string; empty = unspecified. */
  positions: string;
  skillSlugs: string[];
  // Phase 9.19  serialised as strings so the draft round-trips through JSON
  // cleanly. Empty string for the two numeric inputs = "blank = no constraint."
  workAvailability: WorkAvailabilityKind[];
  minYearsExperience: string;
  minNqfLevel: string;
  followUpNudgesEnabled: boolean;
  // Phase 34  Self Apply toggles.
  selfApplyEnabled: boolean;
  salaryVisibleToApplicants: boolean;
  // Phase 9.21  season window as form strings so the JSON draft
  // round-trip is lossless. Empty strings = "no window" (D7); they
  // only get persisted when 'seasonal' is in the chip set.
  seasonalWindowStartMonth: string;
  seasonalWindowEndMonth: string;
  /** Phase 9.21 follow-up  optional anchor years. Empty string = unset.
   *  Year is paired with month via the MonthYearPicker; the form keeps
   *  them as separate scalars in the draft so empty-string round-trips. */
  seasonalWindowStartYear: string;
  seasonalWindowEndYear: string;
  seasonalWindowRecurringAnnually: boolean;
}

const SENIORITY_OPTIONS = [
  "Junior",
  "Intermediate",
  "Senior",
  "Lead / Manager",
];

/**
 * Phase 13.9  the form's local representation of "Any province
 * (remote / hybrid)". Translates to `null` on submit. The leading
 * double-underscore makes it impossible for a real province slug to
 * collide (slugs are kebab-case and never start with `_`).
 */
const PROVINCE_ANY_SENTINEL = "__any";

/**
 * Phase 13.9  is the current work-availability mix one that justifies
 * the "Any province" picker option? D2 in the plan: remote OR hybrid.
 */
function workAvailabilityUnlocksAnyProvince(
  set: Set<WorkAvailabilityKind>,
): boolean {
  return set.has("remote") || set.has("hybrid");
}

// Phase 9.19  the six work_availability_kind enum values, each with a
// human-readable label for the chips. Order mirrors the seeker form
// (Phase 9.18) so a vacancy editor coming from the seeker side sees a
// consistent layout.
// The label is no longer baked in: it comes from
// employerVacancies.form.workAvailability.<value>, so the chips read in
// the employer's own language.
const WORK_AVAILABILITY_CHOICES: ReadonlyArray<{
  value: WorkAvailabilityKind;
}> = [
  { value: "full_time" },
  { value: "part_time" },
  { value: "contract" },
  { value: "casual" },
  // Phase 9.21  recurring calendar-window work; reveals the
  // optional season window sub-block below the chips when picked.
  { value: "seasonal" },
  { value: "remote" },
  { value: "hybrid" },
];

/**
 * Phase 9.21 follow-up  bridge between the MonthYearPicker (ISO
 * yyyy-mm) and the form's flat month/year string state. When year is
 * blank, we still want the picker to show the chosen month, so we
 * synthesise the current year for the picker's display only  the
 * actual year state stays empty (= not anchored).
 */
function composeIsoMonth(monthRaw: string, yearRaw: string): string {
  if (!monthRaw) return "";
  const m = String(monthRaw).padStart(2, "0");
  const y = yearRaw && yearRaw.length === 4 ? yearRaw : String(new Date().getFullYear());
  return `${y}-${m}`;
}

/** Inverse of composeIsoMonth. Returns the raw month + year separately;
 *  caller decides whether to persist the year (we don't anchor unless
 *  the user explicitly set it via the picker). */
function decomposeIsoMonth(iso: string): { month: string; year: string } {
  if (!iso) return { month: "", year: "" };
  const parts = iso.split("-");
  if (parts.length !== 2) return { month: "", year: "" };
  const [y, m] = parts;
  return {
    month: String(parseInt(m ?? "0", 10) || ""),
    year: y && y.length === 4 ? y : "",
  };
}

/**
 * Phase 9.21  build the season-window subset of the submit payload.
 * Clears the window entirely when 'seasonal' isn't picked (D7); when
 * one month is set but the other isn't, treats it as no window (the
 * Zod refine() catches the pairing too  this is the form's belt).
 */
function buildSeasonalWindowSubmit({
  seasonalSelected,
  startRaw,
  endRaw,
  startYearRaw,
  endYearRaw,
  recurringAnnually,
}: {
  seasonalSelected: boolean;
  startRaw: string;
  endRaw: string;
  startYearRaw: string;
  endYearRaw: string;
  recurringAnnually: boolean;
}): {
  seasonalWindowStartMonth: number | null;
  seasonalWindowEndMonth: number | null;
  seasonalWindowStartYear: number | null;
  seasonalWindowEndYear: number | null;
  seasonalWindowRecurringAnnually: boolean | null;
} {
  if (!seasonalSelected) {
    return {
      seasonalWindowStartMonth: null,
      seasonalWindowEndMonth: null,
      seasonalWindowStartYear: null,
      seasonalWindowEndYear: null,
      seasonalWindowRecurringAnnually: null,
    };
  }
  const start = startRaw.trim() === "" ? null : Number(startRaw);
  const end = endRaw.trim() === "" ? null : Number(endRaw);
  if (start === null || end === null) {
    return {
      seasonalWindowStartMonth: null,
      seasonalWindowEndMonth: null,
      seasonalWindowStartYear: null,
      seasonalWindowEndYear: null,
      seasonalWindowRecurringAnnually: null,
    };
  }
  // Year is optional; only submit when present + paired with a valid month.
  const startYear =
    startYearRaw.trim() === "" ? null : Number(startYearRaw);
  const endYear = endYearRaw.trim() === "" ? null : Number(endYearRaw);
  return {
    seasonalWindowStartMonth: start,
    seasonalWindowEndMonth: end,
    seasonalWindowStartYear: startYear,
    seasonalWindowEndYear: endYear,
    seasonalWindowRecurringAnnually: recurringAnnually,
  };
}

// Phase 9.19  NQF dropdown options. The seeker side (`NqfLevel`) only
// captures 4-10 (post-Matric) so we offer the same range here  asking
// a vacancy to require NQF 1-3 would never match any seeker.
const NQF_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 4, label: "4, Matric / National Certificate" },
  { value: 5, label: "5, Higher Certificate" },
  { value: 6, label: "6, Diploma / Advanced Certificate" },
  { value: 7, label: "7, Bachelor's degree" },
  { value: 8, label: "8, Honours / Postgraduate Diploma" },
  { value: 9, label: "9, Master's degree" },
  { value: 10, label: "10, Doctorate" },
];

export function VacancyForm({
  initial,
  professions,
  provinces,
  skills,
  onSubmit,
  redirectTo,
  submitLabel,
  cancelHref = "/employer/vacancies",
  draftId = "new",
  selfApplyFeatureOn = false,
}: VacancyFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("employerVacancies.form");
  const [error, setError] = useState<string | null>(null);

  // Controlled fields  needed for the skills multi-select +
  // conditional rendering. Province / city are simple selects.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [profession, setProfession] = useState(
    initial?.professionSlug ?? "",
  );
  // Phase 13.9  the picker's local state uses three values:
  //   ""        nothing picked yet
  //   PROVINCE_ANY_SENTINEL ("__any")  "Any province (remote / hybrid)"
  //   <slug>    a specific province
  // We translate `__any`  null on submit so the action layer sees the
  // canonical NULL representation (D1). The sentinel never leaves
  // this component.
  const initialProvinceState =
    initial?.provinceSlug === null
      ? PROVINCE_ANY_SENTINEL
      : (initial?.provinceSlug ?? "");
  const [province, setProvince] = useState(initialProvinceState);
  const [seniority, setSeniority] = useState(initial?.seniority ?? "");
  const [salaryBand, setSalaryBand] = useState(initial?.salaryBand ?? "");
  const [description, setDescription] = useState(
    initial?.description ?? "",
  );
  const [inviteExpiryDays, setInviteExpiryDays] = useState<string>(
    initial?.inviteExpiryDays != null
      ? String(initial.inviteExpiryDays)
      : "14",
  );
  // Phase 29.1  optional headcount. Empty string = unspecified (NULL).
  const [positions, setPositions] = useState<string>(
    initial?.positions != null ? String(initial.positions) : "",
  );
  const [skillSet, setSkillSet] = useState<Set<string>>(
    new Set(initial?.skillSlugs ?? []),
  );
  // Phase 9.19  match-requirement fields. Empty array / empty string =
  // "leave blank if this isn't a requirement" (D0: vacancy is source of truth).
  const [workAvailabilitySet, setWorkAvailabilitySet] = useState<
    Set<WorkAvailabilityKind>
  >(new Set(initial?.workAvailability ?? []));
  const [minYearsExperience, setMinYearsExperience] = useState<string>(
    initial?.minYearsExperience != null
      ? String(initial.minYearsExperience)
      : "",
  );
  const [minNqfLevel, setMinNqfLevel] = useState<string>(
    initial?.minNqfLevel != null ? String(initial.minNqfLevel) : "",
  );
  const [followUpNudgesEnabled, setFollowUpNudgesEnabled] = useState<boolean>(
    initial?.followUpNudgesEnabled ?? false,
  );
  // Phase 34  Self Apply toggles.
  const [selfApplyEnabled, setSelfApplyEnabled] = useState<boolean>(
    initial?.selfApplyEnabled ?? false,
  );
  const [salaryVisibleToApplicants, setSalaryVisibleToApplicants] =
    useState<boolean>(initial?.salaryVisibleToApplicants ?? true);
  // Phase 9.21  season window state. Strings so the draft round-trips
  // through JSON; only persisted when 'seasonal' is in the chip set.
  // Reads from either the nested `seasonalWindow` (when initial is a
  // VacancyRow) or the flat fields (when initial is already shaped for
  // submit).
  const [seasonalWindowStartMonth, setSeasonalWindowStartMonth] =
    useState<string>(() => {
      const flat = initial?.seasonalWindowStartMonth;
      if (flat != null) return String(flat);
      const nested = initial?.seasonalWindow?.startMonth;
      return nested != null ? String(nested) : "";
    });
  const [seasonalWindowEndMonth, setSeasonalWindowEndMonth] = useState<string>(
    () => {
      const flat = initial?.seasonalWindowEndMonth;
      if (flat != null) return String(flat);
      const nested = initial?.seasonalWindow?.endMonth;
      return nested != null ? String(nested) : "";
    },
  );
  // Phase 9.21 follow-up  optional anchor years.
  const [seasonalWindowStartYear, setSeasonalWindowStartYear] =
    useState<string>(() => {
      const flat = initial?.seasonalWindowStartYear;
      if (flat != null) return String(flat);
      const nested = initial?.seasonalWindow?.startYear;
      return nested != null ? String(nested) : "";
    });
  const [seasonalWindowEndYear, setSeasonalWindowEndYear] = useState<string>(
    () => {
      const flat = initial?.seasonalWindowEndYear;
      if (flat != null) return String(flat);
      const nested = initial?.seasonalWindow?.endYear;
      return nested != null ? String(nested) : "";
    },
  );
  const [seasonalWindowRecurringAnnually, setSeasonalWindowRecurringAnnually] =
    useState<boolean>(
      initial?.seasonalWindowRecurringAnnually ??
        initial?.seasonalWindow?.recurringAnnually ??
        true,
    );

  // Persist the draft so locale-switching mid-edit doesn't wipe it.
  // Scoped per (create vs edit-vacancy-id) so drafts don't bleed
  // between vacancies. `Set<string>` isn't JSON-serialisable  the
  // persistable shape uses a `string[]` instead.
  const persistable: VacancyDraft = useMemo(
    () => ({
      title,
      profession,
      province,
      seniority: seniority ?? "",
      salaryBand,
      description,
      inviteExpiryDays,
      positions,
      skillSlugs: Array.from(skillSet),
      workAvailability: Array.from(workAvailabilitySet),
      minYearsExperience,
      minNqfLevel,
      followUpNudgesEnabled,
      selfApplyEnabled,
      salaryVisibleToApplicants,
      seasonalWindowStartMonth,
      seasonalWindowEndMonth,
      seasonalWindowStartYear,
      seasonalWindowEndYear,
      seasonalWindowRecurringAnnually,
    }),
    [
      title,
      profession,
      province,
      seniority,
      salaryBand,
      description,
      inviteExpiryDays,
      positions,
      skillSet,
      workAvailabilitySet,
      minYearsExperience,
      minNqfLevel,
      followUpNudgesEnabled,
      selfApplyEnabled,
      salaryVisibleToApplicants,
      seasonalWindowStartMonth,
      seasonalWindowEndMonth,
      seasonalWindowStartYear,
      seasonalWindowEndYear,
      seasonalWindowRecurringAnnually,
    ],
  );
  const { clear: clearDraft } = useSessionDraft<VacancyDraft>(
    `sebenza:vacancy-form-draft:${draftId}`,
    {
      state: persistable,
      onRestore: (draft) => {
        if (draft.title !== undefined) setTitle(draft.title);
        if (draft.profession !== undefined) setProfession(draft.profession);
        if (draft.province !== undefined) setProvince(draft.province);
        if (draft.seniority !== undefined) setSeniority(draft.seniority);
        if (draft.salaryBand !== undefined) setSalaryBand(draft.salaryBand);
        if (draft.description !== undefined) setDescription(draft.description);
        if (draft.inviteExpiryDays !== undefined)
          setInviteExpiryDays(draft.inviteExpiryDays);
        if (draft.positions !== undefined) setPositions(draft.positions);
        if (Array.isArray(draft.skillSlugs))
          setSkillSet(new Set(draft.skillSlugs));
        if (Array.isArray(draft.workAvailability))
          setWorkAvailabilitySet(new Set(draft.workAvailability));
        if (draft.minYearsExperience !== undefined)
          setMinYearsExperience(draft.minYearsExperience);
        if (draft.minNqfLevel !== undefined) setMinNqfLevel(draft.minNqfLevel);
        if (typeof draft.followUpNudgesEnabled === "boolean")
          setFollowUpNudgesEnabled(draft.followUpNudgesEnabled);
        if (typeof draft.selfApplyEnabled === "boolean")
          setSelfApplyEnabled(draft.selfApplyEnabled);
        if (typeof draft.salaryVisibleToApplicants === "boolean")
          setSalaryVisibleToApplicants(draft.salaryVisibleToApplicants);
        if (draft.seasonalWindowStartMonth !== undefined)
          setSeasonalWindowStartMonth(draft.seasonalWindowStartMonth);
        if (draft.seasonalWindowEndMonth !== undefined)
          setSeasonalWindowEndMonth(draft.seasonalWindowEndMonth);
        if (draft.seasonalWindowStartYear !== undefined)
          setSeasonalWindowStartYear(draft.seasonalWindowStartYear);
        if (draft.seasonalWindowEndYear !== undefined)
          setSeasonalWindowEndYear(draft.seasonalWindowEndYear);
        if (typeof draft.seasonalWindowRecurringAnnually === "boolean")
          setSeasonalWindowRecurringAnnually(
            draft.seasonalWindowRecurringAnnually,
          );
      },
    },
  );

  function toggleWorkAvailability(value: WorkAvailabilityKind) {
    setWorkAvailabilitySet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  // Phase 13.9 D6  state convergence. When the user toggles off both
  // `remote` AND `hybrid` while the picker is sitting on the "Any"
  // sentinel, auto-clear the picker back to "Select…" so the form is
  // never in an internally-inconsistent state. The convergence runs
  // one-directionally (toggling remote/hybrid OFF clears Any);
  // toggling remote/hybrid ON does NOT auto-pick Any  the employer
  // must explicitly choose.
  const anyProvinceUnlocked = workAvailabilityUnlocksAnyProvince(
    workAvailabilitySet,
  );
  useEffect(() => {
    if (!anyProvinceUnlocked && province === PROVINCE_ANY_SENTINEL) {
      setProvince("");
    }
  }, [anyProvinceUnlocked, province]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const expiryRaw = inviteExpiryDays.trim();
    const expiryNum =
      expiryRaw === "" || expiryRaw === "0" ? null : Number(expiryRaw);
    if (expiryNum !== null && (!Number.isFinite(expiryNum) || expiryNum < 1)) {
      setError(t("errors.expiry"));
      return;
    }

    // Phase 9.19 D0  blank = no constraint. Empty string maps to NULL,
    // matcher then skips the axis entirely. Validate the numeric inputs
    // only when populated.
    // Phase 29.1  blank = unspecified headcount (NULL). Validate only
    // when populated.
    const positionsRaw = positions.trim();
    const positionsNum = positionsRaw === "" ? null : Number(positionsRaw);
    if (
      positionsNum !== null &&
      (!Number.isFinite(positionsNum) || positionsNum < 1 || positionsNum > 999)
    ) {
      setError(
        t("positionsErr"),
      );
      return;
    }

    const yearsRaw = minYearsExperience.trim();
    const yearsNum = yearsRaw === "" ? null : Number(yearsRaw);
    if (
      yearsNum !== null &&
      (!Number.isFinite(yearsNum) || yearsNum < 0 || yearsNum > 60)
    ) {
      setError(
        t("minYearsErr"),
      );
      return;
    }
    const nqfRaw = minNqfLevel.trim();
    const nqfNum = nqfRaw === "" ? null : Number(nqfRaw);
    if (
      nqfNum !== null &&
      (!Number.isFinite(nqfNum) || nqfNum < 1 || nqfNum > 10)
    ) {
      setError(t("errors.nqf"));
      return;
    }

    // Phase 13.9  translate the "__any" sentinel into the canonical
    // NULL representation the action layer expects. Belt-and-braces:
    // also enforce that NULL province only escapes when remote/hybrid
    // is set (the convergence effect prevents this combination from
    // existing in steady state, but a fast submit during a toggle
    // could race; the server-side gate is the structural backstop).
    let submitProvince: string | null;
    if (province === PROVINCE_ANY_SENTINEL) {
      if (!anyProvinceUnlocked) {
        setError(t("errors.provinceAny"));
        return;
      }
      submitProvince = null;
    } else {
      submitProvince = province;
    }

    const value: VacancyFormValue = {
      title: title.trim(),
      professionSlug: profession,
      provinceSlug: submitProvince,
      citySlug: null, // city refinement is Phase 9.8 vNext, province only for now
      skillSlugs: Array.from(skillSet),
      seniority: seniority || null,
      salaryBand: salaryBand.trim() || null,
      description: description.trim() || null,
      documentsRequired: [], // vNext, for now the matching uses skills + profession
      inviteExpiryDays: expiryNum,
      positions: positionsNum,
      workAvailability: Array.from(workAvailabilitySet),
      minYearsExperience: yearsNum,
      minNqfLevel: nqfNum,
      followUpNudgesEnabled,
      // Phase 34  Self Apply. Always included: the update action's
      // partial-payload guard only skips `undefined`, and this form
      // always knows the current values.
      selfApplyEnabled,
      salaryVisibleToApplicants,
      // Phase 9.21  D7: only persist the window when 'seasonal' is
      // in the chip set; clearing the chip clears the window. The
      // refine() in the Zod schema also catches half-windows; the
      // parseInt + paired check below is the in-form belt-and-braces.
      ...buildSeasonalWindowSubmit({
        seasonalSelected: workAvailabilitySet.has("seasonal"),
        startRaw: seasonalWindowStartMonth,
        endRaw: seasonalWindowEndMonth,
        startYearRaw: seasonalWindowStartYear,
        endYearRaw: seasonalWindowEndYear,
        recurringAnnually: seasonalWindowRecurringAnnually,
      }),
    };

    startTransition(async () => {
      const res = await onSubmit(value);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      clearDraft();
      router.push(redirectTo as never);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
          The role
        </div>
        <TextField
          id="title"
          name="title"
          label={t("title.label")}
          placeholder={t("title.placeholder")}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
          hint={t("title.hint")}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <ComboboxField
            id="profession"
            name="profession"
            label={t("profession.label")}
            required
            value={profession}
            onChange={setProfession}
            disabled={pending}
            options={professions.map((p) => ({
              value: p.slug,
              label: p.label,
            }))}
            placeholder={t("profession.placeholder")}
            allowOther
            otherLabel={t("professionOther")}
          />
          <div>
            <SelectField
              id="province"
              name="province"
              label={t("province.label")}
              required
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              disabled={pending}
            >
              <option value="">{t("province.select")}</option>
              {/* Phase 13.9  "Any province" sentinel. Only listed
                  when work_availability includes remote or hybrid
                  (D2). Removed via state convergence (D6) when the
                  user toggles those modes off. */}
              {anyProvinceUnlocked && (
                <option value={PROVINCE_ANY_SENTINEL}>
                  Any province (remote / hybrid)
                </option>
              )}
              {provinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </SelectField>
            {province === PROVINCE_ANY_SENTINEL && (
              <p className="mt-1 text-xs italic text-[color:var(--color-ink-soft)]">
                Candidates from every province match; the location
                filter is off. City field is not used.
              </p>
            )}
          </div>
        </div>
        <SelectField
          id="seniority"
          name="seniority"
          label={t("seniority.label")}
          value={seniority ?? ""}
          onChange={(e) => setSeniority(e.target.value)}
          disabled={pending}
        >
          <option value="">{t("seniority.any")}</option>
          {SENIORITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>

        {/* Phase 10 follow-up  skills are now a typeahead multi-select
            with profession-scoped suggestions surfaced first. The old
            chip-toggle (every skill in the taxonomy shown as a chip)
            doesn't scale past ~30 entries, see PROFESSION_SKILLS_MAP
            in lib/mock/taxonomy.ts for the ranking source. */}
        <MultiSelectComboboxField
          id="skillSlugs"
          label={t("skills.label")}
          helpText={t("skillsHelp")}
          values={Array.from(skillSet)}
          onChange={(next) => setSkillSet(new Set(next))}
          options={skills.map((s) => ({ value: s.slug, label: s.label }))}
          suggestedValues={
            profession ? PROFESSION_SKILLS_MAP[profession] ?? [] : []
          }
          placeholder={t("skills.placeholder")}
          disabled={pending}
          allowOther
          otherLabel={t("skillsOther")}
          otherHint="Can't find a skill? Just keep typing it and add it - our team reviews new skills."
          splitOtherOnComma
        />

        <TextareaField
          id="description"
          name="description"
          label={t("description.label")}
          optional
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          placeholder={t("description.placeholder")}
          maxLength={4000}
        />
      </section>

      <hr className="hairline" />

      {/* Phase 9.19  match requirements. Every axis is optional: leave
          blank if the role doesn't ask for it, and the matcher won't
          constrain on it. SA-context driver: trades / hospitality /
          casual labour / sales rarely require formal NQF credentials,
          so the form must never push organisers to pick one. */}
      <section className="flex flex-col gap-5">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          {t("match.heading")}
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          {t("match.sub")}
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            {t("workMode.legend")}
          </legend>
          <p className="text-xs text-[color:var(--color-ink-soft)]">
            {t("workMode.sub")}
          </p>
          <ul className="-mb-2 flex flex-wrap gap-2 pt-1">
            {WORK_AVAILABILITY_CHOICES.map((choice) => {
              const on = workAvailabilitySet.has(choice.value);
              return (
                <li key={choice.value}>
                  <button
                    type="button"
                    onClick={() => toggleWorkAvailability(choice.value)}
                    disabled={pending}
                    aria-pressed={on}
                    className={
                      "rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs transition-colors " +
                      (on
                        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                        : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                    }
                  >
                    {t(`workAvailability.${choice.value}`)}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Phase 9.21 D7  conditional season-window sub-block.
              Only renders when 'seasonal' is in the chip set; untoggling
              the chip clears the displayed inputs but keeps the local
              state so re-toggling restores the user's draft (the
              submit path still gates on the chip being on). */}
          {workAvailabilitySet.has("seasonal") && (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                {t("season.heading")}
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                {t("season.sub")}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <MonthYearPicker
                  id="seasonalWindowStart"
                  label={t("season.start")}
                  value={composeIsoMonth(
                    seasonalWindowStartMonth,
                    seasonalWindowStartYear,
                  )}
                  onChange={(iso) => {
                    const { month, year } = decomposeIsoMonth(iso);
                    setSeasonalWindowStartMonth(month);
                    setSeasonalWindowStartYear(year);
                  }}
                  disabled={pending}
                />
                {/* Hidden inputs ferry the month + year into the form post
                    (the MonthYearPicker stores a single ISO string; the
                    server action reads the flat month/year fields). */}
                <input
                  type="hidden"
                  name="seasonalWindowStartMonth"
                  value={seasonalWindowStartMonth}
                />
                <input
                  type="hidden"
                  name="seasonalWindowStartYear"
                  value={seasonalWindowStartYear}
                />
                <MonthYearPicker
                  id="seasonalWindowEnd"
                  label={t("season.end")}
                  value={composeIsoMonth(
                    seasonalWindowEndMonth,
                    seasonalWindowEndYear,
                  )}
                  onChange={(iso) => {
                    const { month, year } = decomposeIsoMonth(iso);
                    setSeasonalWindowEndMonth(month);
                    setSeasonalWindowEndYear(year);
                  }}
                  disabled={pending}
                />
                <input
                  type="hidden"
                  name="seasonalWindowEndMonth"
                  value={seasonalWindowEndMonth}
                />
                <input
                  type="hidden"
                  name="seasonalWindowEndYear"
                  value={seasonalWindowEndYear}
                />
              </div>
              <label className="mt-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={seasonalWindowRecurringAnnually}
                  onChange={(e) =>
                    setSeasonalWindowRecurringAnnually(e.target.checked)
                  }
                  disabled={pending}
                  className="mt-0.5 size-4 cursor-pointer accent-[color:var(--color-ink)]"
                />
                <span className="flex-1 text-sm">
                  <span className="font-display text-base text-[color:var(--color-ink)]">
                    This window repeats every year
                  </span>
                  <span className="mt-0.5 block text-xs text-[color:var(--color-ink-soft)]">
                    Default for most seasonal roles. When ticked, the
                    year is the FIRST occurrence anchor. Untick for
                    one-off runs (e.g. a tournament pop-up that
                    won&rsquo;t repeat).
                  </span>
                </span>
              </label>
            </div>
          )}
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="minYearsExperience"
            name="minYearsExperience"
            label={t("minYears.label")}
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            optional
            value={minYearsExperience}
            onChange={(e) => setMinYearsExperience(e.target.value)}
            disabled={pending}
            hint={t("minYears.hint")}
          />
          <SelectField
            id="minNqfLevel"
            name="minNqfLevel"
            label={t("minNqf.label")}
            optional
            value={minNqfLevel}
            onChange={(e) => setMinNqfLevel(e.target.value)}
            disabled={pending}
            hint={t("minNqf.hint")}
          >
            <option value="">{t("minNqf.none")}</option>
            {NQF_OPTIONS.map((opt) => (
              <option key={opt.value} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      <hr className="hairline" />

      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          <Lock className="size-3" aria-hidden="true" />
          {t("salary.heading")}
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          {t("salary.sub")}
        </p>
        <TextField
          id="salaryBand"
          name="salaryBand"
          label={t("salary.label")}
          placeholder={t("salary.placeholder")}
          optional
          value={salaryBand}
          onChange={(e) => setSalaryBand(e.target.value)}
          disabled={pending}
          badge={
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
              <Lock className="size-2.5" aria-hidden="true" />
              {t("salary.badge")}
            </span>
          }
        />
      </section>

      <hr className="hairline" />

      <section className="flex flex-col gap-5">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          {t("expiry.heading")}
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          {t("expiry.sub")}
        </p>
        <TextField
          id="inviteExpiryDays"
          name="inviteExpiryDays"
          label={t("expiry.label")}
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={inviteExpiryDays}
          onChange={(e) => setInviteExpiryDays(e.target.value)}
          disabled={pending}
          hint={t("expiry.hint")}
        />

        {/* Phase 29.1  optional headcount. Blank = unspecified; the match
            page then shows plain invite counts with no seat framing. */}
        <TextField
          id="positions"
          name="positions"
          label={t("positions.label")}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          optional
          value={positions}
          onChange={(e) => setPositions(e.target.value)}
          disabled={pending}
          hint={t("positions.hint")}
        />

        {/* Phase 9.19 D8  opt-in follow-up nudge. A single gentle
            reminder fires 7 days after the invite if the seeker
            hasn't responded; capped at one nudge per invite ever
            (re-nudging is harassment). Default OFF  today no seeker
            expects a follow-up. */}
        <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
          <input
            type="checkbox"
            checked={followUpNudgesEnabled}
            onChange={(e) => setFollowUpNudgesEnabled(e.target.checked)}
            disabled={pending}
            className="mt-0.5 size-4 cursor-pointer accent-[color:var(--color-ink)]"
          />
          <span className="flex-1 text-sm">
            <span className="font-display text-base text-[color:var(--color-ink)]">
              {t("nudge.label")}
            </span>
            <span className="mt-0.5 block text-xs text-[color:var(--color-ink-soft)]">
              {t("nudge.sub")}
            </span>
          </span>
        </label>

        {/* Phase 34  Self Apply. Rendered only while the platform flag
            is ON (ship-dark). Honest copy about exactly what the public
            link shows, and what it never shows. */}
        {selfApplyFeatureOn && (
          <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-brand)]/30 bg-[color:var(--color-brand-tint)] p-4">
            <legend className="px-1 font-display text-base">
              {t("selfApply.legend")}
            </legend>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selfApplyEnabled}
                onChange={(e) => setSelfApplyEnabled(e.target.checked)}
                disabled={pending}
                className="mt-0.5 size-4 cursor-pointer accent-[color:var(--color-brand-strong)]"
              />
              <span className="flex-1 text-sm">
                <span className="font-display text-base text-[color:var(--color-ink)]">
                  {t("selfApply.label")}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
                  Generates a shareable page with the role, skills and
                  description (never the salary band for visitors, never
                  your pipeline). Applicants land in this vacancy&rsquo;s
                  pipeline as accepted candidates with a
                  &ldquo;Self-applied&rdquo; chip. You review and
                  shortlist them like invited seekers. Untick any time to
                  switch the link off; it also pauses automatically when
                  the vacancy is closed or filled.
                </span>
              </span>
            </label>
            {selfApplyEnabled && (
              <label className="mt-3 flex items-start gap-3 border-t border-[color:var(--color-brand)]/20 pt-3">
                <input
                  type="checkbox"
                  checked={salaryVisibleToApplicants}
                  onChange={(e) =>
                    setSalaryVisibleToApplicants(e.target.checked)
                  }
                  disabled={pending}
                  className="mt-0.5 size-4 cursor-pointer accent-[color:var(--color-brand-strong)]"
                />
                <span className="flex-1 text-sm">
                  <span className="font-display text-base text-[color:var(--color-ink)]">
                    Show the salary band to signed-in applicants
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
                    Anonymous visitors never see it either way; this only
                    controls what a signed-in seeker sees on the apply
                    page.
                  </span>
                </span>
              </label>
            )}
          </fieldset>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-hairline)] pt-5">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => router.push(cancelHref as never)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? t("saving") : (submitLabel ?? t("submit"))}
        </Button>
      </div>
    </form>
  );
}
