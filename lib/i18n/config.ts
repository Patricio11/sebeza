import type { AppLocale } from "@/i18n/routing";

// Locale metadata for the switcher. Each language is labelled in its own name.
// Tier 2/3 locales (per ROADMAP.md Phase 10) are not yet enabled in routing.
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  zu: "isiZulu",
  xh: "isiXhosa",
  af: "Afrikaans",
};

export const LOCALES: AppLocale[] = ["en", "zu", "xh", "af"];
