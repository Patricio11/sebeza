"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PROFESSIONS, PROVINCES } from "@/lib/mock/taxonomy";
import { Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Props {
  /** "hero" sits inside the landing hero  large + editorial. "compact" is for the search header. */
  variant?: "hero" | "compact";
  defaultQuery?: string;
  defaultLocation?: string;
  className?: string;
}

/**
 * Search-First Rule (TO_START_EVERY_SESSION.md §1). The search bar IS the
 * landing hero. Composed inline with hairline dividers  deliberately not a
 * pill input. Profession is a datalist (real autocomplete from the taxonomy),
 * location is a province select.
 *
 * Progressive enhancement: it's a plain <form method="GET">  submits without JS.
 */
export function SearchBar({
  variant = "hero",
  defaultQuery = "",
  defaultLocation = "",
  className,
}: Props) {
  const t = useTranslations("landing.search");
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const [loc, setLoc] = useState(defaultLocation);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (loc) params.set("province", loc);
    router.push(`/search?${params.toString()}` as "/search");
  }

  const isHero = variant === "hero";

  return (
    <form
      action="/search"
      method="get"
      onSubmit={onSubmit}
      className={cn(
        "group relative w-full",
        isHero
          ? "rounded-[var(--radius-lg)] border border-[color:var(--color-ink)] bg-[color:var(--color-surface)] shadow-soft"
          : "rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]",
        className,
      )}
    >
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto]",
          isHero ? "md:items-stretch" : "md:items-center",
        )}
      >
        <Field
          isHero={isHero}
          label={t("professionLabel")}
          eyebrow="01"
        >
          <input
            list="profession-list"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("professionPlaceholder")}
            className={cn(
              "w-full border-0 bg-transparent text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-ink-soft)]",
              isHero ? "text-lg md:text-xl" : "text-base",
            )}
          />
          <datalist id="profession-list">
            {PROFESSIONS.map((p) => (
              <option key={p.slug} value={p.label} />
            ))}
          </datalist>
        </Field>

        <Divider isHero={isHero} />

        {/* Phase 13.9 follow-up  the location cell wraps a CustomSelect
            which renders a <button>. A <label> wrapping a <button> on
            mobile fires a synthetic click on the button when the
            label is tapped, colliding with the user's actual tap and
            toggling the picker open/close in one gesture. The
            `wrapAsDiv` prop keeps the visual eyebrow + label intact
            but renders the wrapper as a <div>; the CustomSelect
            carries its own aria-label for screen readers. */}
        <Field
          isHero={isHero}
          label={t("locationLabel")}
          eyebrow="02"
          wrapAsDiv
        >
          <CustomSelect
            name="province"
            value={loc}
            onChange={setLoc}
            placeholder={t("locationPlaceholder")}
            ariaLabel={t("locationLabel")}
            variant="bare"
            triggerTextClassName={
              isHero ? "text-lg md:text-xl" : "text-base"
            }
            options={PROVINCES.map((p) => ({ value: p.slug, label: p.label }))}
          />
        </Field>

        <button
          type="submit"
          className={cn(
            "flex items-center justify-center gap-2 bg-[color:var(--color-ink)] text-[color:var(--color-paper)] transition-colors hover:bg-[color:var(--color-brand-strong)]",
            isHero
              ? "h-auto rounded-b-[var(--radius-lg)] px-7 py-5 text-base md:rounded-l-none md:rounded-r-[var(--radius-lg)] md:py-0"
              : "h-11 rounded-[var(--radius-md)] px-5",
          )}
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="font-display tracking-tight">{t("submit")}</span>
        </button>
      </div>
    </form>
  );
}

function Field({
  isHero,
  label,
  eyebrow,
  children,
  wrapAsDiv = false,
}: {
  isHero: boolean;
  label: string;
  eyebrow: string;
  children: React.ReactNode;
  /**
   * Phase 13.9 follow-up  when the child is a `<button>` (e.g.
   * `<CustomSelect>` for the location cell), pass `wrapAsDiv` to
   * render the wrapper as a `<div>` instead of a `<label>`. A
   * `<label>` wrapping a `<button>` on mobile fires a synthetic
   * click on the button when the label is tapped, which collides
   * with the user's actual tap and toggles the picker open/close
   * in one gesture. The visible eyebrow + label text are preserved
   * regardless; accessibility relies on the child's own aria-label.
   * The `<input>`-bearing profession cell keeps the `<label>` for
   * the native form-control + label association.
   */
  wrapAsDiv?: boolean;
}) {
  const Wrapper = (wrapAsDiv ? "div" : "label") as "div" | "label";
  if (!isHero) {
    return (
      <Wrapper className="flex min-w-0 items-center gap-3 px-4 py-2">
        <span className="sr-only">{label}</span>
        {children}
      </Wrapper>
    );
  }
  return (
    <Wrapper className="flex min-w-0 flex-col gap-1 px-6 py-4">
      <span className="flex items-baseline gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        <span className="font-display text-[color:var(--color-accent)]">
          {eyebrow}
        </span>
        {label}
      </span>
      {children}
    </Wrapper>
  );
}

function Divider({ isHero }: { isHero: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-[color:var(--color-hairline)]",
        isHero
          ? "hidden md:block md:w-px"
          : "h-px w-full md:h-auto md:w-px",
      )}
    />
  );
}
