"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { AppLocale } from "@/i18n/routing";

/**
 * Persistent language switcher. UX_UI_SPEC §3.1 — every language labelled
 * in its own name (Zulu shows "isiZulu"). Uses CustomSelect so the dropdown
 * looks like Sebenza on every platform, not the OS default.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("landing.footer");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <CustomSelect
      ariaLabel={t("language")}
      icon={<Languages className="size-4" aria-hidden="true" />}
      variant="compact"
      value={locale}
      disabled={pending}
      className="min-w-[160px]"
      options={LOCALES.map((l) => ({
        value: l,
        label: LOCALE_LABELS[l],
      }))}
      onChange={(next) => {
        startTransition(() => {
          router.replace(pathname, { locale: next as AppLocale });
        });
      }}
    />
  );
}
