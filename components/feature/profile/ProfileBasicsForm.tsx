"use client";

/**
 * Client island that wraps the profile-editor sections (identity / location /
 * professional / bio). Submits to `updateProfileBasics`. Skills, national ID,
 * and academic record have their own islands so saves can be partial.
 */

import { useMemo, useState, useTransition } from "react";
import { TextField, TextareaField, SelectField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { MultiSelectComboboxField } from "@/components/ui/MultiSelectComboboxField";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { updateProfileBasics } from "@/lib/profile/actions";
import { PROVINCES } from "@/lib/mock/taxonomy";
import type { Seniority } from "@/lib/mock/types";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";

interface InitialValues {
  displayName: string;
  profession: string;
  /**
   * Phase 13.10  additional profession lanes (cap 3). LABELS, not
   * slugs  matches the storage convention of the primary `profession`
   * field. Empty array on legacy rows; the editor opens to "no
   * secondaries" by default.
   */
  secondaryProfessions: string[];
  seniority: Seniority | null;
  city: string;
  province: string;
  nationality: string | null;
  isCitizen: boolean;
  bio: string;
  completeness: number;
  /** Phase 9.9  total years of professional experience. NULL = "rather
   *  not say." UI accepts blank or 0..60. */
  yearsExperience: number | null;
}

/** Phase 13.10 D2  cap on secondary professions. Set in one place so
 *  the form, action validation, and tests stay in lockstep. */
const SECONDARY_PROFESSIONS_MAX = 3;

interface Props {
  initial: InitialValues;
  /** Slug list for the profession select (full set in Phase 7 admin). */
  professions: { slug: string; label: string }[];
  /** Where the SectionHeading lives  left intact so the existing eyebrow numbering is unaffected. */
  identityHeading: React.ReactNode;
  locationHeading: React.ReactNode;
  professionalHeading: React.ReactNode;
  /** Localized field labels passed in by the server component. */
  labels: {
    displayName: string;
    displayNameHelp: string;
    province: string;
    city: string;
    willingToRelocate: string;
    profession: string;
    seniority: string;
    bio: string;
    bioHelp: string;
    saveButton: string;
    completenessLive: string;
    citizen: string;
    nationality: string;
  };
}

export function ProfileBasicsForm({
  initial,
  professions,
  identityHeading,
  locationHeading,
  professionalHeading,
  labels,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [profession, setProfession] = useState(initial.profession);
  // Phase 13.10  cap at SECONDARY_PROFESSIONS_MAX in onChange; the
  // server action also caps independently (D2 invariant).
  const [secondaryProfessions, setSecondaryProfessions] = useState<string[]>(
    initial.secondaryProfessions ?? [],
  );
  const [seniority, setSeniority] = useState<Seniority | null>(initial.seniority);
  const [province, setProvince] = useState(initial.province);
  const [city, setCity] = useState(initial.city);
  const [nationality, setNationality] = useState(initial.nationality ?? "South African");
  const [isCitizen, setIsCitizen] = useState(initial.isCitizen);
  const [bio, setBio] = useState(initial.bio ?? "");
  // Phase 9.9  total years of experience. Stored as a string in form
  // state so blank means NULL (vs 0 which means "<1 yr"). Clamped to
  // 0..60 at submit time AND server-side in updateProfileBasics.
  const [yearsExperience, setYearsExperience] = useState<string>(
    initial.yearsExperience != null ? String(initial.yearsExperience) : "",
  );

  const cities = PROVINCES.find((p) => p.slug === province)?.cities ?? [];

  // Persist the in-flight edits so the locale switcher doesn't
  // discard them. Scoped to the signed-in user's own profile editor
  // (single instance per browser tab  no per-id scoping needed).
  const persistable = useMemo(
    () => ({
      displayName,
      profession,
      secondaryProfessions,
      seniority,
      province,
      city,
      nationality,
      isCitizen,
      bio,
      yearsExperience,
    }),
    [
      displayName,
      profession,
      secondaryProfessions,
      seniority,
      province,
      city,
      nationality,
      isCitizen,
      bio,
      yearsExperience,
    ],
  );
  const { clear: clearDraft } = useSessionDraft<typeof persistable>(
    "sebenza:profile-basics-draft",
    {
      state: persistable,
      onRestore: (draft) => {
        if (draft.displayName !== undefined) setDisplayName(draft.displayName);
        if (draft.profession !== undefined) setProfession(draft.profession);
        if (Array.isArray(draft.secondaryProfessions))
          setSecondaryProfessions(
            draft.secondaryProfessions.slice(0, SECONDARY_PROFESSIONS_MAX),
          );
        if (draft.seniority !== undefined) setSeniority(draft.seniority);
        if (draft.province !== undefined) setProvince(draft.province);
        if (draft.city !== undefined) setCity(draft.city);
        if (draft.nationality !== undefined) setNationality(draft.nationality);
        if (draft.isCitizen !== undefined) setIsCitizen(draft.isCitizen);
        if (draft.bio !== undefined) setBio(draft.bio);
        if (draft.yearsExperience !== undefined)
          setYearsExperience(draft.yearsExperience);
      },
    },
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const yearsRaw = yearsExperience.trim();
      const yearsNum =
        yearsRaw === ""
          ? null
          : Math.max(0, Math.min(60, Math.floor(Number(yearsRaw))));
      const r = await updateProfileBasics({
        displayName,
        profession,
        // Phase 13.10  belt-and-braces filter: dedupe + drop the
        // primary if a user added it as a secondary (the server
        // action refuses this combination anyway). Cap is enforced
        // again server-side for the curl / scripted-submit case.
        secondaryProfessions: Array.from(
          new Set(
            secondaryProfessions
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && s !== profession),
          ),
        ).slice(0, SECONDARY_PROFESSIONS_MAX),
        seniority: seniority ?? null,
        city,
        province,
        nationality: nationality || null,
        isCitizen,
        bio: bio || null,
        yearsExperience:
          yearsNum !== null && Number.isFinite(yearsNum) ? yearsNum : null,
      });
      if (r.ok) {
        setMessage({ kind: "ok", text: "Saved." });
        clearDraft();
      } else {
        setMessage({ kind: "error", text: r.message });
      }
    });
  }

  return (
    <form className="space-y-12" onSubmit={handleSubmit}>
      {/* Identity */}
      <section id="identity">
        {identityHeading}
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="displayName"
            label={labels.displayName}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            hint={labels.displayNameHelp}
            autoComplete="name"
          />
          <TextField
            id="nationality"
            label={labels.nationality}
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            name="nationality"
            autoComplete="off"
            placeholder="e.g. South African"
            hint="Free text  Sebenza matches by location + skill, never by nationality."
          />
          <Checkbox
            className="mt-2 md:mt-auto md:pb-3"
            align="center"
            checked={isCitizen}
            onChange={setIsCitizen}
            label={labels.citizen}
          />
        </div>
      </section>

      {/* Location */}
      <section id="location">
        {locationHeading}
        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            id="province"
            label={labels.province}
            value={province}
            name="province"
            onChange={(e) => {
              const next = (e.target as HTMLSelectElement).value;
              setProvince(next);
              const firstCity = PROVINCES.find((p) => p.slug === next)
                ?.cities[0]?.slug;
              if (firstCity) setCity(firstCity);
            }}
          >
            {PROVINCES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="city"
            label={labels.city}
            value={city}
            name="city"
            onChange={(e) => setCity((e.target as HTMLSelectElement).value)}
          >
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {/* Professional */}
      <section id="professional">
        {professionalHeading}
        <div className="grid gap-5 md:grid-cols-2">
          <ComboboxField
            id="profession"
            label={labels.profession}
            value={profession}
            name="profession"
            onChange={setProfession}
            options={professions.map((p) => ({
              value: p.slug,
              label: p.label,
            }))}
            placeholder="Search professions…"
            allowOther
            otherLabel="My profession isn't listed"
          />
          {/* Phase 13.10  secondary profession lanes. Capped at 3
              via the onChange + the server-side refine. Stores
              LABELS (matches profiles.profession convention). No
              allowOther path  D3 in PHASE_13_10_PLAN.md keeps the
              matcher's signal clean. Sits in the same grid cell as
              its sibling fields; spans both columns at md+ so the
              chips have room to breathe. */}
          <MultiSelectComboboxField
            label="Also experienced in (optional)"
            helpText={`Up to ${SECONDARY_PROFESSIONS_MAX} other professions you've worked in. Surfaces you to employers who search for those roles. Your headline stays the primary above.`}
            values={secondaryProfessions}
            onChange={(next) => {
              const cleaned = Array.from(
                new Set(next.filter((v) => v && v !== profession)),
              ).slice(0, SECONDARY_PROFESSIONS_MAX);
              setSecondaryProfessions(cleaned);
            }}
            options={professions.map((p) => ({
              value: p.label,
              label: p.label,
            }))}
            placeholder={
              secondaryProfessions.length >= SECONDARY_PROFESSIONS_MAX
                ? `${SECONDARY_PROFESSIONS_MAX} reached  remove one to add another`
                : "Search professions…"
            }
            className="md:col-span-2"
          />
          <SelectField
            id="seniority"
            label={labels.seniority}
            value={seniority ?? "intermediate"}
            name="seniority"
            onChange={(e) =>
              setSeniority(
                (e.target as HTMLSelectElement).value as Seniority,
              )
            }
          >
            <option value="junior">Junior</option>
            <option value="intermediate">Intermediate</option>
            <option value="senior">Senior</option>
          </SelectField>
          {/* Phase 9.9  total years of experience. Optional; UI clamps
              0..60; blank = NULL ("rather not say"). 0 displays as "<1 yr"
              everywhere it renders. */}
          <TextField
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            label="Total years of experience"
            placeholder="e.g. 8"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            hint="How long you've been working in your field. Leave blank if you'd rather not say."
          />
          <TextareaField
            id="bio"
            label={labels.bio}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            hint={labels.bioHelp}
            className="md:col-span-2"
          />
        </div>
      </section>

      {message && (
        <p
          className={
            message.kind === "ok"
              ? "text-sm text-[color:var(--color-employed)]"
              : "text-sm text-[color:var(--color-danger)]"
          }
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {labels.completenessLive}
          </div>
          <ProfileCompleteness value={initial.completeness} />
        </div>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : labels.saveButton}
        </Button>
      </div>
    </form>
  );
}
