import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Deep-merges per-locale overrides onto the English base catalog.
// This lets non-English catalogs be incomplete during rollout — missing keys
// fall back to English instead of breaking the build. As professional human
// translations arrive, the per-locale files get filled in.
// NEVER machine-translate consent / POPIA / legal copy (see TO_START_EVERY_SESSION.md).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../messages/en.json`)).default;
  const overrides =
    locale === "en"
      ? {}
      : (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages: deepMerge(base, overrides),
  };
});

type Json = { [k: string]: unknown };

function deepMerge<T>(base: T, override: unknown): T {
  if (
    typeof base !== "object" ||
    base === null ||
    typeof override !== "object" ||
    override === null ||
    Array.isArray(base) ||
    Array.isArray(override)
  ) {
    return (override === undefined ? base : (override as T));
  }
  const out: Json = { ...(base as Json) };
  for (const k of Object.keys(override as Json)) {
    out[k] = deepMerge((base as Json)[k], (override as Json)[k]);
  }
  return out as T;
}
