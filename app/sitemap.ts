/**
 * Phase 9  Generated sitemap. Phase 33 pass (docs/PHASE_33_SEO_PLAN.md):
 *
 *   - Base URL + locale routing now come from `lib/seo.ts` (D1  one
 *     source of truth, honouring next-intl's `localePrefix: "as-needed"`).
 *     The old version emitted `/en/...` canonicals which the i18n proxy
 *     307-redirects to the unprefixed form  every entry self-redirected.
 *   - `/terms` + `/accessibility` added (both routes shipped 2026-07-02
 *     but were never listed).
 *   - Static-route `lastModified` uses a maintained CONTENT_UPDATED
 *     stamp instead of always-now (an always-fresh lastModified trains
 *     crawlers to distrust the field).
 *
 * Public surfaces only: landing, /search, /insights, the legal pages,
 * and every consented profile at /p/<handle>. We do NOT list dashboard
 * / employer / admin / gov routes (per-user data, no SEO value).
 *
 * Per-locale entries via the `alternates.languages` block so Google
 * understands the i18n routing.
 */

import type { MetadataRoute } from "next";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { routing } from "@/i18n/routing";
import { localeUrl } from "@/lib/seo";

/**
 * Bump when static-page CONTENT meaningfully changes (legal-page
 * updates, landing rewrites)  not on every deploy.
 */
const CONTENT_UPDATED = new Date("2026-07-28");

function localised(path: string): {
  url: string;
  alternates: { languages: Record<string, string> };
} {
  return {
    // Canonical = the default-locale (en, UNPREFIXED) URL  the form
    // the router actually serves without a redirect.
    url: localeUrl(routing.defaultLocale, path),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, localeUrl(l, path)]),
      ),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/search", priority: 0.9, changeFrequency: "daily" },
    { path: "/insights", priority: 0.8, changeFrequency: "daily" },
    // The copy-led explainer funnel (docs/MARKETING_PAGE_COPY.md).
    { path: "/marketing", priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" },
    { path: "/paia", priority: 0.5, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.5, changeFrequency: "monthly" },
    { path: "/accessibility", priority: 0.4, changeFrequency: "monthly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    ...localised(s.path),
    lastModified: CONTENT_UPDATED,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  // Per-profile entries  only consented, non-deleted profiles. We
  // join consents to confirm `searchability = granted` before
  // surfacing the handle in the sitemap. (Same join as
  // `isProfileIndexableQuery`  a handle is listed here IFF its page
  // emits `index`.)
  let profileEntries: MetadataRoute.Sitemap = [];
  try {
    const db = getDb();
    const rows = await db
      .select({
        handle: schema.profiles.handle,
        updatedAt: schema.profiles.statusConfirmedAt,
      })
      .from(schema.profiles)
      .innerJoin(
        schema.consents,
        and(
          eq(schema.consents.userId, schema.profiles.userId),
          eq(schema.consents.purpose, "searchability"),
          eq(schema.consents.state, "granted"),
        ),
      )
      .where(isNull(schema.profiles.deletedAt))
      .limit(50_000);
    profileEntries = rows.map((r) => ({
      ...localised(`/p/${r.handle}`),
      lastModified: r.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Build-time DB unreachable  fall back to static surfaces only.
  }

  return [...staticEntries, ...profileEntries];
}
