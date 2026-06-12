"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { PROVINCES } from "@/lib/mock/taxonomy";
import type { EmploymentStatus, SearchFilters as F, Seniority, VerificationStatus } from "@/lib/mock/types";
import { WORK_AVAILABILITY_KINDS } from "@/lib/mock/types";
import { WORK_AVAILABILITY_LABEL } from "@/components/feature/profile/WorkAvailabilityChips";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Checkbox } from "@/components/ui/Checkbox";

interface Props {
  defaultFilters: F;
  query: string;
}

const STATUSES: EmploymentStatus[] = [
  "open_to_work",
  "employed",
  "self_employed",
  "studying",
  "unemployed",
];
const SENIORITIES: Seniority[] = ["junior", "intermediate", "senior"];
const VERIFICATIONS: VerificationStatus[] = ["verified", "pending", "unverified"];

/**
 * Search filter rail. Mobile = bottom sheet (native <dialog>), desktop = sticky
 * left column. Filters propagate via URL params  shareable links, no client state.
 */
export function SearchFilters({ defaultFilters, query }: Props) {
  const t = useTranslations("search.filters");
  const tStatus = useTranslations("status");
  const tVer = useTranslations("verification");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const province = PROVINCES.find((p) => p.slug === defaultFilters.province) ?? null;

  function update(next: Partial<F>) {
    const merged: F = { ...defaultFilters, ...next };
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (merged.province) params.set("province", merged.province);
    if (merged.city) params.set("city", merged.city);
    if (merged.status) params.set("status", merged.status);
    if (merged.seniority) params.set("seniority", merged.seniority);
    if (merged.verification) params.set("verification", merged.verification);
    if (merged.highlightCitizens) params.set("highlight", "1");
    if (merged.openToInternships) params.set("internships", "1");
    if (merged.openToGraduateProgrammes) params.set("graduates", "1");
    if (merged.availableFor && merged.availableFor.length > 0) {
      params.set("availableFor", merged.availableFor.join(","));
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as never);
    });
  }

  function clear() {
    startTransition(() => {
      router.replace(query ? `${pathname}?q=${encodeURIComponent(query)}` as never : (pathname as never));
    });
  }

  const body = (
    <div className={cn("flex flex-col gap-7", pending && "opacity-60")}>
      <FilterGroup label={t("province")}>
        <CustomSelect
          ariaLabel={t("province")}
          variant="compact"
          placeholder="All provinces"
          value={defaultFilters.province ?? ""}
          onChange={(v) => update({ province: v || null, city: null })}
          options={[
            { value: "", label: "All provinces" },
            ...PROVINCES.map((p) => ({ value: p.slug, label: p.label })),
          ]}
        />
      </FilterGroup>

      {province && (
        <FilterGroup label={t("city")}>
          <CustomSelect
            ariaLabel={t("city")}
            variant="compact"
            placeholder={`All cities in ${province.label}`}
            value={defaultFilters.city ?? ""}
            onChange={(v) => update({ city: v || null })}
            options={[
              {
                value: "",
                label: `All cities in ${province.label}`,
              },
              ...province.cities.map((c) => ({
                value: c.slug,
                label: c.label,
              })),
            ]}
          />
        </FilterGroup>
      )}

      <FilterGroup label={t("status")}>
        <ChipRow
          options={STATUSES.map((s) => ({ value: s, label: tStatus(s) }))}
          value={defaultFilters.status ?? null}
          onChange={(v) => update({ status: (v as EmploymentStatus) || null })}
        />
      </FilterGroup>

      <FilterGroup label={t("seniority")}>
        <ChipRow
          options={SENIORITIES.map((s) => ({ value: s, label: s }))}
          value={defaultFilters.seniority ?? null}
          onChange={(v) => update({ seniority: (v as Seniority) || null })}
        />
      </FilterGroup>

      <FilterGroup label={t("nationality")}>
        <Checkbox
          checked={defaultFilters.highlightCitizens ?? false}
          onChange={(v) => update({ highlightCitizens: v })}
          label={t("highlightCitizens")}
          description={t("nationalityHelp")}
        />
      </FilterGroup>

      <FilterGroup label={t("verification")}>
        <ChipRow
          options={VERIFICATIONS.map((v) => ({ value: v, label: tVer(v) }))}
          value={defaultFilters.verification ?? null}
          onChange={(v) => update({ verification: (v as VerificationStatus) || null })}
        />
      </FilterGroup>

      {/* Phase 6: scope to seekers in Student mode who opted in to the
          internship or graduate-programme intake. Strictly opt-in by the
          seeker; never default; never inferred. */}
      <FilterGroup label="Early-career opt-ins">
        <Checkbox
          checked={defaultFilters.openToInternships ?? false}
          onChange={(v) => update({ openToInternships: v || undefined })}
          label="Open to internships"
          description="Currently-enrolled students who've explicitly opted in."
        />
        <Checkbox
          className="mt-3"
          checked={defaultFilters.openToGraduateProgrammes ?? false}
          onChange={(v) =>
            update({ openToGraduateProgrammes: v || undefined })
          }
          label="Open to graduate programmes"
          description="Final-year + recent graduates open to formal grad-track roles."
        />
      </FilterGroup>

      <FilterGroup label="Available for">
        {WORK_AVAILABILITY_KINDS.map((kind) => {
          const checked = (defaultFilters.availableFor ?? []).includes(kind);
          return (
            <Checkbox
              key={kind}
              className="mt-2 first:mt-0"
              checked={checked}
              onChange={(v) => {
                const cur = defaultFilters.availableFor ?? [];
                const next = v
                  ? Array.from(new Set([...cur, kind]))
                  : cur.filter((x) => x !== kind);
                update({ availableFor: next.length > 0 ? next : undefined });
              }}
              label={WORK_AVAILABILITY_LABEL[kind]}
            />
          );
        })}
        <p className="mt-2 text-xs italic text-[color:var(--color-ink-soft)]">
          Self-declared by each seeker  independent of employment status.
        </p>
      </FilterGroup>

      <button
        type="button"
        onClick={clear}
        className="self-start text-sm text-[color:var(--color-brand)] underline-offset-2 hover:underline"
      >
        {t("clear")}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile sheet trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 py-2 text-sm"
      >
        {t("open")}
      </button>

      {/* Mobile sheet */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("title")}
          className="fixed inset-0 z-50 flex items-end md:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-lg)] border-t-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl">{t("title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
              >
                {t("close")}
              </button>
            </div>
            {body}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] py-3 font-medium text-[color:var(--color-paper)]"
            >
              {t("apply")}
            </button>
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside
        aria-label={t("title")}
        className="hidden md:block md:sticky md:top-24 md:self-start"
      >
        <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-lg">
          {t("title")}
        </h2>
        {body}
      </aside>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? null : o.value)}
            className={cn(
              "cursor-pointer rounded-[var(--radius-pill)] border px-3 py-1 text-xs capitalize transition-colors",
              active
                ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
