import { notFound } from "next/navigation";

/**
 * Catch-all for every path no real route matched
 * (docs/ERROR_PAGES_404_PLAN.md, the documented next-intl pattern).
 *
 * Without this, URL shapes that fail the locale layout's validation
 * fall through to Next's plain default 404. With it, `notFound()`
 * renders the branded `app/[locale]/not-found.tsx` inside the locale
 * layout for EVERY unknown path (the edge proxy rewrites unknown
 * prefixes onto the default locale, so this boundary always applies).
 *
 * Specific routes always win over a catch-all; this only ever sees
 * paths nothing else claimed.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
