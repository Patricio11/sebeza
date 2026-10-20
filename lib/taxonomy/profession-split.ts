/**
 * A typed profession can carry more than one role: "AI Automation
 * Specialist | Supply Chain Architect", "Chef / Baker". Founder call
 * (2026-10-20): the separator means "and also". The first part is the
 * primary profession, the rest are secondary professions, and each part
 * that is not already canonical becomes its own suggestion for the admin
 * queue, so the queue never shows a joined string again.
 *
 * Pure. The caller supplies the canonical labels (DB-backed where
 * possible, so promoted professions count as canonical too).
 *
 * Only `|` and a slash WITH spaces on both sides split. A bare slash is
 * part of real labels ("UX/UI Designer", "Driver/Operator") and is left
 * alone.
 */

export const SECONDARY_PROFESSIONS_MAX = 3;

const SEPARATOR = /\s*(?:\||\s\/\s)\s*/;

export interface ProfessionSplit {
  /** The headline profession (canonical label when it matched). */
  primary: string;
  /** Up to SECONDARY_PROFESSIONS_MAX further roles, primary excluded. */
  secondaries: string[];
  /** Parts (primary + secondaries) that are NOT canonical yet. */
  customParts: string[];
  /** True when the text held more than one usable part. */
  wasSplit: boolean;
}

function clean(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function hasProfessionSeparator(text: string): boolean {
  return SEPARATOR.test(clean(text));
}

export function splitProfessionText(
  text: string,
  canonicalLabels: Iterable<string>,
): ProfessionSplit {
  const canonical = new Map<string, string>();
  for (const label of canonicalLabels) canonical.set(label.toLowerCase(), label);
  const toCanonical = (s: string) => canonical.get(s.toLowerCase()) ?? s;

  const whole = clean(text);
  // A canonical label that itself contains a separator is never split.
  if (canonical.has(whole.toLowerCase())) {
    return { primary: toCanonical(whole), secondaries: [], customParts: [], wasSplit: false };
  }

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of whole.split(SEPARATOR)) {
    const part = toCanonical(clean(raw));
    if (part.length < 2) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(part);
  }
  if (parts.length === 0) {
    return { primary: whole, secondaries: [], customParts: canonical.has(whole.toLowerCase()) ? [] : [whole], wasSplit: false };
  }

  const primary = parts[0]!;
  const secondaries = parts.slice(1, 1 + SECONDARY_PROFESSIONS_MAX);
  const customParts = [primary, ...secondaries].filter(
    (p) => !canonical.has(p.toLowerCase()),
  );
  return { primary, secondaries, customParts, wasSplit: parts.length > 1 };
}

/**
 * Merge secondaries from a split with what the seeker already had,
 * dropping the primary and duplicates (case-insensitive), capped.
 */
export function mergeSecondaryProfessions(
  primary: string,
  ...lists: ReadonlyArray<readonly string[]>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>([primary.toLowerCase()]);
  for (const list of lists) {
    for (const raw of list) {
      const s = clean(raw);
      if (s.length < 2) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= SECONDARY_PROFESSIONS_MAX) return out;
    }
  }
  return out;
}
