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

/**
 * Phase 10.3 (PHASE_10_PLAN.md)  scaffolded Tier-2 / Tier-3 locale
 * stubs that exist as `messages/<code>.json` with `__notice` markers
 * but are NOT yet enabled in `i18n/routing.ts`. Adding any of these
 * to routing requires:
 *
 *   1. Consent / POPIA / legal copy 100% professionally human-
 *      translated (the rule from TO_START_EVERY_SESSION.md never
 *      relaxes; machine translation is forbidden here).
 *   2. UI copy >= 80% complete with English deepMerge for the rest
 *      (i18n/request.ts handles the fallback).
 *   3. A native + Sebenza-side reviewer signs off on the catalog.
 *
 * Once a locale meets all three, move its entry from this map into
 * `LOCALE_LABELS` above + add its code to `routing.locales` in
 * `i18n/routing.ts`. The order matters: routing activates the URL
 * prefix + middleware; the label drives the switcher UI. Adding to
 * routing without a label yields a switcher with the raw code.
 */
export const PENDING_LOCALES = {
  // Tier 2  remaining seven official SA languages
  nso: "Sepedi",
  tn: "Setswana",
  st: "Sesotho",
  ts: "Xitsonga",
  ve: "Tshivenda",
  ss: "siSwati",
  nr: "isiNdebele",
  // Tier 3  SADC + foreign-national community
  pt: "Portugues",
  fr: "Francais",
  sw: "Kiswahili",
} as const;

export type PendingLocaleCode = keyof typeof PENDING_LOCALES;
