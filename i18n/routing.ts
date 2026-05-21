import { defineRouting } from "next-intl/routing";

// Tier 1 (launch): English (base), isiZulu, isiXhosa, Afrikaans.
// Tier 2/3 scaffolded but not yet enabled in routing — see ROADMAP.md Phase 10.
export const routing = defineRouting({
  locales: ["en", "zu", "xh", "af"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
