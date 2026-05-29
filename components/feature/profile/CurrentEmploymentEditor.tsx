"use client";

/**
 * Phase 9.22  dashboard editor for the seeker's current employment.
 *
 * Three optional fields backed by `profiles.current_employer_org_id /
 * current_role_started_at / current_role_city`. The employer combobox
 * uses Phase 9.15's `allowOther` so the seeker can pick from the
 * verified list OR submit a new pending org (admin reviews +
 * promotes).
 *
 * The component renders flat (no save button) at first  any change
 * triggers a debounced auto-save through `updateCurrentEmployment`.
 * Mirrors `WorkAvailabilityEditor`'s optimistic-toggle posture so the
 * dashboard surface feels consistent across editors.
 */

import { useState, useTransition } from "react";
import { TextField, SelectField } from "@/components/ui/FormField";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { Button } from "@/components/ui/Button";
import { updateCurrentEmployment } from "@/lib/profile/employment";
import { Building2 } from "lucide-react";

export interface EmployerOption {
  id: string;
  name: string;
  city: string | null;
  badge: "sebenza_registered" | "seeker_named_verified";
  listedBySeekerCount: number;
}

interface Props {
  initial: {
    currentEmployerOrgId: string | null;
    currentEmployerName: string | null;
    currentRoleStartedAt: string | null;
    currentRoleCity: string | null;
  };
  options: ReadonlyArray<EmployerOption>;
  /** When the seeker's currently-FK'd org is still pending admin
   *  review, surface the free-text name here so the editor can
   *  display it. The picker doesn't list pending orgs (D3). */
  pendingEmployerName: string | null;
}

export function CurrentEmploymentEditor({
  initial,
  options,
  pendingEmployerName,
}: Props) {
  // Initial combobox value:
  //   - existing org id when the seeker has one verified  the picker
  //     surfaces it.
  //   - free-text label when the seeker's current org is still pending
  //     (the option isn't in the picker; we still want the editor to
  //     show the text the seeker entered).
  //   - empty string otherwise.
  const initialValue = (() => {
    if (initial.currentEmployerOrgId) {
      const opt = options.find((o) => o.id === initial.currentEmployerOrgId);
      if (opt) return opt.id;
      if (pendingEmployerName) return pendingEmployerName;
    }
    return "";
  })();

  const [employerValue, setEmployerValue] = useState(initialValue);
  const [employerCity, setEmployerCity] = useState("");
  const [roleStartedYear, setRoleStartedYear] = useState(
    initial.currentRoleStartedAt
      ? initial.currentRoleStartedAt.slice(0, 4)
      : "",
  );
  const [roleStartedMonth, setRoleStartedMonth] = useState(
    initial.currentRoleStartedAt
      ? String(Number(initial.currentRoleStartedAt.slice(5, 7)))
      : "",
  );
  const [roleCity, setRoleCity] = useState(initial.currentRoleCity ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSave() {
    setError(null);
    setSaved(false);
    const employerIsPicked = options.some((o) => o.id === employerValue);
    const trimmedCustom = !employerIsPicked ? employerValue.trim() : "";
    startTransition(async () => {
      const res = await updateCurrentEmployment({
        employerOrgId: employerIsPicked ? employerValue : null,
        ...(trimmedCustom
          ? {
              customEmployerName: trimmedCustom,
              ...(employerCity.trim()
                ? { customEmployerCity: employerCity.trim() }
                : {}),
            }
          : {}),
        roleStartedAt:
          roleStartedYear && roleStartedMonth
            ? `${roleStartedYear}-${roleStartedMonth.padStart(2, "0")}-01`
            : null,
        roleCity: roleCity.trim() || null,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
    });
  }

  function onClear() {
    setError(null);
    setSaved(false);
    setEmployerValue("");
    setEmployerCity("");
    setRoleStartedYear("");
    setRoleStartedMonth("");
    setRoleCity("");
    startTransition(async () => {
      const res = await updateCurrentEmployment({
        employerOrgId: null,
        roleStartedAt: null,
        roleCity: null,
      });
      if (!res.ok) setError(res.message);
      else setSaved(true);
    });
  }

  const isOtherMode =
    employerValue.trim().length > 0 &&
    !options.some((o) => o.id === employerValue);

  return (
    <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <legend className="px-1 font-display text-base">
        <Building2 className="mr-2 inline size-4" aria-hidden="true" />
        Where you work
      </legend>
      <p className="mb-4 text-xs text-[color:var(--color-ink-soft)]">
        Optional. Visible on your public profile when the employer is
        verified. Pick from the list or use Other to add a new employer
        (admin reviews + verifies before it appears in the picker for
        others).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <ComboboxField
          id="current-employer-dash"
          label="Current employer"
          value={employerValue}
          onChange={setEmployerValue}
          options={options.map((o) => ({
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
        {isOtherMode && (
          <TextField
            id="current-employer-city-dash"
            label="Employer city"
            placeholder="e.g. Sandton"
            value={employerCity}
            onChange={(e) => setEmployerCity(e.target.value)}
          />
        )}
        <SelectField
          id="role-started-month-dash"
          label="Started (month)"
          value={roleStartedMonth}
          onChange={(e) => setRoleStartedMonth(e.target.value)}
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
          id="role-started-year-dash"
          label="Started (year)"
          value={roleStartedYear}
          onChange={(e) => setRoleStartedYear(e.target.value)}
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
          id="role-city-dash"
          label="City you work in"
          placeholder="e.g. Cape Town  leave blank to use your home city"
          value={roleCity}
          onChange={(e) => setRoleCity(e.target.value)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="min-h-[1rem]">
          {pending && (
            <span className="text-[color:var(--color-ink-soft)]">Saving</span>
          )}
          {!pending && saved && (
            <span className="text-[color:var(--color-employed)]">
              Saved. Visible on your public profile when the employer is
              verified.
            </span>
          )}
          {error && (
            <span className="text-[color:var(--color-danger)]">{error}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClear}
            disabled={pending}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={pending}
          >
            Save
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
