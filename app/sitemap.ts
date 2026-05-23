/**
 * Phase 9 — Generated sitemap.
 *
 * Public surfaces only: landing, /search, /insights, /privacy, /paia,
 * and every consented profile at /p/<handle>. We do NOT list dashboard
 * / employer / admin / gov routes (those carry per-user data and have
 * no SEO value).
 *
 * Per-locale entries via the `alternates.languages` block so Google
 * understands the i18n routing.
 */

import type { MetadataRoute } from "next";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

const APP_URL = (
  process.env.BETTER_AUTH_URL ?? "https://sebenza.co.za"
).replace(/\/$/, "");

const LOCALES = ["en", "zu", "xh", "af"] as const;
const DEFAULT_LOCALE = "en";

function localised(path: string): {
  url: string;
  alternates: { languages: Record<string, string> };
} {
  const trimmed = path.replace(/^\//, "");
  return {
    url: `${APP_URL}/${DEFAULT_LOCALE}${trimmed ? `/${trimmed}` : ""}`,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          l,
          `${APP_URL}/${l}${trimmed ? `/${trimmed}` : ""}`,
        ]),
      ),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/search", priority: 0.9, changeFrequency: "daily" },
    { path: "/insights", priority: 0.8, changeFrequency: "daily" },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" },
    { path: "/paia", priority: 0.5, changeFrequency: "monthly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    ...localised(s.path),
    lastModified: now,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  // Per-profile entries — only consented, non-deleted profiles. We
  // join consents to confirm `searchability = granted` before
  // surfacing the handle in the sitemap.
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
    // Build-time DB unreachable — fall back to static surfaces only.
  }

  return [...staticEntries, ...profileEntries];
}
