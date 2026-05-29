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

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  TextField,
  TextareaField,
  SelectField,
} from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { Lock } from "lucide-react";
import type {
  TaxonomyEntry,
  Province,
  WorkAvailabilityKind,
} from "@/lib/mock/types";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";

export interface VacancyFormValue {
  title: string;
  professionSlug: string;
  provinceSlug: string;
  citySlug?: string | null;
  skillSlugs: string[];
  seniority?: string | null;
  salaryBand?: string | null;
  description?: string | null;
  documentsRequired: string[];
  inviteExpiryDays?: number | null;
  /** Phase 9.19  empty array = no constraint (matcher ignores axis). */
  workAvailability: WorkAvailabilityKind[];
  /** Phase 9.19  NULL = no constraint (matcher does NOT check this axis). */
  minYearsExperience?: number | null;
  /** Phase 9.19  NULL = no NQF check at all (every seeker passes). */
  minNqfLevel?: number | null;
}

export interface VacancyFormProps {
  initial?: Partial<VacancyFormValue>;
  professions: TaxonomyEntry[];
  provinces: Province[];
  skills: TaxonomyEntry[];
  /** Server Action wrapper. Returns the result to surface errors. */
  onSubmit: (
    value: VacancyFormValue,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** Where to navigate on success. */
  redirectTo: string;
  /** Submit button label. Defaults to "Save vacancy". */
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
}

interface VacancyDraft {
  title: string;
  profession: string;
  province: string;
  seniority: string;
  salaryBand: string;
  description: string;
  inviteExpiryDays: string;
  skillSlugs: string[];
  // Phase 9.19  serialised as strings so the draft round-trips through JSON
  // cleanly. Empty string for the two numeric inputs = "blank = no constraint."
  workAvailability: WorkAvailabilityKind[];
  minYearsExperience: string;
  minNqfLevel: string;
}

const SENIORITY_OPTIONS = [
  "Junior",
  "Intermediate",
  "Senior",
  "Lead / Manager",
];

// Phase 9.19  the six work_availability_kind enum values, each with a
// human-readable label for the chips. Order mirrors the seeker form
// (Phase 9.18) so a vacancy editor coming from the seeker side sees a
// consistent layout.
const WORK_AVAILABILITY_CHOICES: ReadonlyArray<{
  value: WorkAvailabilityKind;
  label: string;
}> = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "casual", label: "Casual" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

// Phase 9.19  NQF dropdown options. The seeker side (`NqfLevel`) only
// captures 4-10 (post-Matric) so we offer the same range here  asking
// a vacancy to require NQF 1-3 would never match any seeker.
const NQF_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 4, label: "4  Matric / National Certificate" },
  { value: 5, label: "5  Higher Certificate" },
  { value: 6, label: "6  Diploma / Advanced Certificate" },
  { value: 7, label: "7  Bachelor's degree" },
  { value: 8, label: "8  Honours / Postgraduate Diploma" },
  { value: 9, label: "9  Master's degree" },
  { value: 10, label: "10  Doctorate" },
];

export function VacancyForm({
  initial,
  professions,
  provinces,
  skills,
  onSubmit,
  redirectTo,
  submitLabel = "Save vacancy",
  cancelHref = "/employer/vacancies",
  draftId = "new",
}: VacancyFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Controlled fields  needed for the skills multi-select +
  // conditional rendering. Province / city are simple selects.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [profession, setProfession] = useState(
    initial?.professionSlug ?? "",
  );
  const [province, setProvince] = useState(initial?.provinceSlug ?? "");
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
      skillSlugs: Array.from(skillSet),
      workAvailability: Array.from(workAvailabilitySet),
      minYearsExperience,
      minNqfLevel,
    }),
    [
      title,
      profession,
      province,
      seniority,
      salaryBand,
      description,
      inviteExpiryDays,
      skillSet,
      workAvailabilitySet,
      minYearsExperience,
      minNqfLevel,
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
        if (Array.isArray(draft.skillSlugs))
          setSkillSet(new Set(draft.skillSlugs));
        if (Array.isArray(draft.workAvailability))
          setWorkAvailabilitySet(new Set(draft.workAvailability));
        if (draft.minYearsExperience !== undefined)
          setMinYearsExperience(draft.minYearsExperience);
        if (draft.minNqfLevel !== undefined) setMinNqfLevel(draft.minNqfLevel);
      },
    },
  );

  function toggleSkill(slug: string) {
    setSkillSet((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleWorkAvailability(value: WorkAvailabilityKind) {
    setWorkAvailabilitySet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const expiryRaw = inviteExpiryDays.trim();
    const expiryNum =
      expiryRaw === "" || expiryRaw === "0" ? null : Number(expiryRaw);
    if (expiryNum !== null && (!Number.isFinite(expiryNum) || expiryNum < 1)) {
      setError("Invite expiry must be empty or a positive number of days.");
      return;
    }

    // Phase 9.19 D0  blank = no constraint. Empty string maps to NULL,
    // matcher then skips the axis entirely. Validate the numeric inputs
    // only when populated.
    const yearsRaw = minYearsExperience.trim();
    const yearsNum = yearsRaw === "" ? null : Number(yearsRaw);
    if (
      yearsNum !== null &&
      (!Number.isFinite(yearsNum) || yearsNum < 0 || yearsNum > 60)
    ) {
      setError(
        "Minimum years of experience must be empty, or a whole number between 0 and 60.",
      );
      return;
    }
    const nqfRaw = minNqfLevel.trim();
    const nqfNum = nqfRaw === "" ? null : Number(nqfRaw);
    if (
      nqfNum !== null &&
      (!Number.isFinite(nqfNum) || nqfNum < 1 || nqfNum > 10)
    ) {
      setError("Minimum NQF level must be empty, or between 1 and 10.");
      return;
    }

    const value: VacancyFormValue = {
      title: title.trim(),
      professionSlug: profession,
      provinceSlug: province,
      citySlug: null, // city refinement is Phase 9.8 vNext  province only for now
      skillSlugs: Array.from(skillSet),
      seniority: seniority || null,
      salaryBand: salaryBand.trim() || null,
      description: description.trim() || null,
      documentsRequired: [], // vNext  for now the matching uses skills + profession
      inviteExpiryDays: expiryNum,
      workAvailability: Array.from(workAvailabilitySet),
      minYearsExperience: yearsNum,
      minNqfLevel: nqfNum,
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
          label="Role title"
          placeholder="e.g. Senior Pastry Chef"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
          hint="The label your team sees on the vacancy list."
        />
        <div className="grid gap-5 md:grid-cols-2">
          <ComboboxField
            id="profession"
            name="profession"
            label="Profession"
            required
            value={profession}
            onChange={setProfession}
            disabled={pending}
            options={professions.map((p) => ({
              value: p.slug,
              label: p.label,
            }))}
            placeholder="Search professions…"
          />
          <SelectField
            id="province"
            name="province"
            label="Province"
            required
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            disabled={pending}
          >
            <option value="">Select…</option>
            {provinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField
          id="seniority"
          name="seniority"
          label="Seniority"
          value={seniority ?? ""}
          onChange={(e) => setSeniority(e.target.value)}
          disabled={pending}
        >
          <option value="">Any / not specified</option>
          {SENIORITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>

        {/* Skills  taxonomy-controlled multi-chip selector */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Required skills
          </legend>
          <p className="text-xs text-[color:var(--color-ink-soft)]">
            Tap to add or remove. These drive the &ldquo;Find matches&rdquo;
            ranking in 9.8.2.
          </p>
          <ul className="-mb-2 flex flex-wrap gap-2 pt-1">
            {skills.map((s) => {
              const on = skillSet.has(s.slug);
              return (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => toggleSkill(s.slug)}
                    disabled={pending}
                    aria-pressed={on}
                    className={
                      "rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs transition-colors " +
                      (on
                        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                        : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                    }
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <TextareaField
          id="description"
          name="description"
          label="Description"
          optional
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          placeholder="What the role does, who it reports to, what success looks like in the first 90 days. Internal-only  no seeker ever sees this."
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
          Match requirements
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          Used to narrow the candidate list on the &ldquo;Find matches&rdquo;
          screen. Leave any field blank if it isn&rsquo;t a requirement &mdash;
          the matcher then ignores that axis entirely.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Work mode &amp; employment type
          </legend>
          <p className="text-xs text-[color:var(--color-ink-soft)]">
            Pick all that apply. None selected = the role accepts any work
            mode / employment type.
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
                    {choice.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="minYearsExperience"
            name="minYearsExperience"
            label="Minimum years of experience"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            optional
            value={minYearsExperience}
            onChange={(e) => setMinYearsExperience(e.target.value)}
            disabled={pending}
            hint="Leave blank if this isn't a requirement. Seekers who haven't declared a number won't pass once a floor is set."
          />
          <SelectField
            id="minNqfLevel"
            name="minNqfLevel"
            label="Minimum NQF level"
            optional
            value={minNqfLevel}
            onChange={(e) => setMinNqfLevel(e.target.value)}
            disabled={pending}
            hint="Leave blank if this isn't a requirement (most trades, hospitality, casual labour and sales roles won't need one)."
          >
            <option value="">No NQF requirement</option>
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
          Private to your organisation
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          Salary band stays inside your workspace  consistent with how
          Sebenza already handles placement salaries (Phase 5 rule). It
          is never on any seeker-facing surface, never in /search,
          never in /p/[handle].
        </p>
        <TextField
          id="salaryBand"
          name="salaryBand"
          label="Salary band"
          placeholder="e.g. R 480k  R 600k / year"
          optional
          value={salaryBand}
          onChange={(e) => setSalaryBand(e.target.value)}
          disabled={pending}
          badge={
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
              <Lock className="size-2.5" aria-hidden="true" />
              Private
            </span>
          }
        />
      </section>

      <hr className="hairline" />

      <section className="flex flex-col gap-5">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          Invite expiry
        </div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          How long an invite stays open if the seeker hasn&rsquo;t responded.
          When it expires, both sides get a notification. Leave empty (or 0)
          to keep invites open indefinitely.
        </p>
        <TextField
          id="inviteExpiryDays"
          name="inviteExpiryDays"
          label="Days until invite expires"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={inviteExpiryDays}
          onChange={(e) => setInviteExpiryDays(e.target.value)}
          disabled={pending}
          hint="14 days is the typical default; 0 or empty = never expires."
        />
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
          {pending ? "Saving" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
