"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { useTransition } from "react";

/**
 * Persistent language switcher (UX_UI_SPEC §3.1). Native <select> for
 * accessibility + zero JS framework cost beyond the router transition.
 * Each language is labelled in its own name.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("landing.footer");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-[color:var(--color-ink-soft)]">{t("language")}:</span>
      <select
        value={locale}
        onChange={onChange}
        disabled={pending}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1 text-[color:var(--color-ink)]"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
