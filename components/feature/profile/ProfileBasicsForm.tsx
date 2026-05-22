"use client";

/**
 * Client island that wraps the profile-editor sections (identity / location /
 * professional / bio). Submits to `updateProfileBasics`. Skills, national ID,
 * and academic record have their own islands so saves can be partial.
 */

import { useState, useTransition } from "react";
import { TextField, TextareaField, SelectField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { updateProfileBasics } from "@/lib/profile/actions";
import { PROVINCES } from "@/lib/mock/taxonomy";
import type { Seniority } from "@/lib/mock/types";

interface InitialValues {
  displayName: string;
  profession: string;
  seniority: Seniority | null;
  city: string;
  province: string;
  nationality: string | null;
  isCitizen: boolean;
  bio: string;
  completeness: number;
}

interface Props {
  initial: InitialValues;
  /** Slug list for the profession select (full set in Phase 7 admin). */
  professions: { slug: string; label: string }[];
  /** Where the SectionHeading lives — left intact so the existing eyebrow numbering is unaffected. */
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
  const [seniority, setSeniority] = useState<Seniority | null>(initial.seniority);
  const [province, setProvince] = useState(initial.province);
  const [city, setCity] = useState(initial.city);
  const [nationality, setNationality] = useState(initial.nationality ?? "South African");
  const [isCitizen, setIsCitizen] = useState(initial.isCitizen);
  const [bio, setBio] = useState(initial.bio ?? "");

  const cities = PROVINCES.find((p) => p.slug === province)?.cities ?? [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await updateProfileBasics({
        displayName,
        profession,
        seniority: seniority ?? null,
        city,
        province,
        nationality: nationality || null,
        isCitizen,
        bio: bio || null,
      });
      if (r.ok) {
        setMessage({ kind: "ok", text: "Saved." });
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
            hint="Free text — Sebenza matches by location + skill, never by nationality."
          />
          <label className="mt-2 inline-flex items-center gap-2 text-sm md:mt-auto md:pb-3">
            <input
              type="checkbox"
              checked={isCitizen}
              onChange={(e) => setIsCitizen(e.target.checked)}
              className="size-4"
            />
            {labels.citizen}
          </label>
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
          <SelectField
            id="profession"
            label={labels.profession}
            value={profession}
            name="profession"
            onChange={(e) =>
              setProfession((e.target as HTMLSelectElement).value)
            }
          >
            {professions.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </SelectField>
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
