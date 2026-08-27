/**
 * ONE canonical on-disk form for `profiles.province` and `profiles.city`:
 * the human LABEL ("Western Cape", "Cape Town"). Every reader already
 * assumed it (search matches `lower(p.province) = lower(label)`, stall
 * reasons derive the slug with REPLACE, the seed maps labels), but two
 * writers stored the picker's SLUG instead, which split the live
 * register in two: a seeker saved as "western-cape" was invisible to a
 * Western Cape search and ranked in a pool of their own.
 *
 * Pure and DB-free (taxonomy constants only) so the server actions, the
 * client editor and the seed can all share it. Unknown values are kept
 * as typed (trimmed), never dropped: admin-added cities live in the DB
 * `cities` table and are already labels when they reach us.
 */

import { PROVINCES } from "@/lib/mock/taxonomy";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Province label for a slug OR label (any case); null when unknown. */
export function canonicalProvinceLabel(input: string | null | undefined): string | null {
  if (!input) return null;
  const n = norm(input);
  if (!n) return null;
  const hit = PROVINCES.find((p) => p.slug === n || norm(p.label) === n);
  return hit?.label ?? null;
}

/** Province slug for a slug OR label (any case); null when unknown. */
export function provinceSlugFor(input: string | null | undefined): string | null {
  if (!input) return null;
  const n = norm(input);
  if (!n) return null;
  const hit = PROVINCES.find((p) => p.slug === n || norm(p.label) === n);
  return hit?.slug ?? null;
}

/**
 * City label for a slug OR label. Searches the given province's cities
 * first (province may itself be a slug or a label), then every province,
 * so a stray value still resolves. Unknown input is returned trimmed:
 * "" stays "", free text stays free text.
 */
export function canonicalCityLabel(
  input: string | null | undefined,
  province?: string | null,
): string {
  if (!input) return "";
  const raw = input.trim();
  const n = raw.toLowerCase();
  if (!n) return "";
  const provinceSlug = provinceSlugFor(province);
  const ordered = provinceSlug
    ? [
        ...PROVINCES.filter((p) => p.slug === provinceSlug),
        ...PROVINCES.filter((p) => p.slug !== provinceSlug),
      ]
    : PROVINCES;
  for (const p of ordered) {
    const hit = p.cities.find((c) => c.slug === n || norm(c.label) === n);
    if (hit) return hit.label;
  }
  return raw;
}

/** City slug for a slug OR label; null when the city is not in the taxonomy. */
export function citySlugFor(
  input: string | null | undefined,
  province?: string | null,
): string | null {
  if (!input) return null;
  const n = norm(input);
  if (!n) return null;
  const provinceSlug = provinceSlugFor(province);
  const ordered = provinceSlug
    ? [
        ...PROVINCES.filter((p) => p.slug === provinceSlug),
        ...PROVINCES.filter((p) => p.slug !== provinceSlug),
      ]
    : PROVINCES;
  for (const p of ordered) {
    const hit = p.cities.find((c) => c.slug === n || norm(c.label) === n);
    if (hit) return hit.slug;
  }
  return null;
}
