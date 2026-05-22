"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { PROVINCES } from "@/lib/mock/taxonomy";
import type { EmploymentStatus, SearchFilters as F, Seniority, VerificationStatus } from "@/lib/mock/types";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";

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
 * left column. Filters propagate via URL params — shareable links, no client state.
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

      <FilterGroup label={t("verification")}>
        <ChipRow
          options={VERIFICATIONS.map((v) => ({ value: v, label: tVer(v) }))}
          value={defaultFilters.verification ?? null}
          onChange={(v) => update({ verification: (v as VerificationStatus) || null })}
        />
      </FilterGroup>

      <FilterGroup label={t("nationality")}>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={defaultFilters.highlightCitizens ?? false}
            onChange={(e) => update({ highlightCitizens: e.target.checked })}
            className="mt-1"
          />
          <span>
            {t("highlightCitizens")}
            <span className="mt-1 block text-xs text-[color:var(--color-ink-soft)]">
              {t("nationalityHelp")}
            </span>
          </span>
        </label>
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
              "rounded-[var(--radius-pill)] border px-3 py-1 text-xs capitalize transition-colors",
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
