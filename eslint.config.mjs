import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Phase 12 lint-debt triage (2026-06-12)  `npm run lint` is back in
    // the quality gate (`test:all`); these adjustments are the documented
    // reasoning, not a mute button:
    rules: {
      // This rule guards the legacy `pages/` directory, which this
      // project has never had (App Router from commit one). Every one of
      // its 98 hits was a false positive  deliberate <a> elements to
      // API download endpoints (CSV/JSON exports must be plain anchors)
      // or locale-prefixed app routes the rule cannot resolve.
      "@next/next/no-html-link-for-pages": "off",
      // React escapes text nodes; unescaped apostrophes/quotes in this
      // copy-heavy editorial product are noise, not risk (40 hits, all
      // in static prose).
      "react/no-unescaped-entities": "off",
      // The react-hooks v6 generation rules shipped with this
      // eslint-config-next AFTER most of the codebase. The flagged
      // patterns are largely deliberate: mount-gated client islands
      // (Recharts SSR-sizing dodge), per-request Date.now() in Server
      // Components (per-request render is the intent), sessionStorage
      // draft restoration in effects (Phase 9.18). Kept VISIBLE as
      // warnings so new code improves; triage to fix-or-suppress
      // per-site is post-launch backlog work.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
