import { defineRouting } from "next-intl/routing";

// Tier 1 (launch): English (base), isiZulu, isiXhosa, Afrikaans.
//
// Phase 10.3 (PHASE_10_PLAN.md) added stub catalogs for Tier-2 +
// Tier-3 locales (`messages/{nso,tn,st,ts,ve,ss,nr,pt,fr,sw}.json`)
// but they are NOT enabled in routing yet. To enable a Tier-2 /
// Tier-3 locale, see the readiness threshold + checklist in
// `lib/i18n/config.ts` PENDING_LOCALES.
export const routing = defineRouting({
  locales: ["en", "zu", "xh", "af"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
