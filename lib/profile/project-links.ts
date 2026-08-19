/**
 * 2026-08-19  pure helpers for "Work & projects"
 * (docs/PROFILE_PROJECTS_PLAN.md). No DB, no I/O  unit-tested.
 *
 * Link policy: http(s) ONLY. `javascript:`/`data:` are XSS vectors;
 * `mailto:`/`tel:` are refused because they would quietly bypass the
 * audited, consent-gated contact-reveal flow (Redaction Rule).
 * We NEVER fetch the URL server-side (SSRF + page weight)  the
 * hostname is shown to viewers so they see where a link goes.
 */

/** Caps live here (not in the "use server" module: a Server-Action file
 *  may only export async functions, so a client import of a constant
 *  from there fails the build). */
export const MAX_PROJECTS = 6;
export const MAX_IMAGES_PER_PROJECT = 5;

export type LinkResult =
  | { ok: true; url: string | null }
  | { ok: false; message: string };

const BLOCKED_SCHEMES = ["javascript:", "data:", "mailto:", "tel:", "file:"];

export function normaliseProjectUrl(raw: string | null | undefined): LinkResult {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return { ok: true, url: null };
  if (trimmed.length > 300) {
    return { ok: false, message: "That link is too long." };
  }

  const lower = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return {
        ok: false,
        message:
          scheme === "mailto:" || scheme === "tel:"
            ? "Add a web link here. Employers reach you through Sebenza, not from your profile."
            : "That kind of link isn't allowed. Use a web address starting with https://",
      };
    }
  }

  // Bare "example.co.za/thing" is what people actually type.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, message: "That doesn't look like a web address." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      message: "Use a web address starting with https://",
    };
  }
  if (!parsed.hostname.includes(".") || parsed.hostname.endsWith(".")) {
    return { ok: false, message: "That doesn't look like a web address." };
  }
  return { ok: true, url: parsed.toString() };
}

/** Hostname for display next to a link, so viewers see the destination. */
export function linkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** 9+ digits allowing one separator between them  SA numbers, not years. */
const PHONE_RE = /(?:\+?\d[\s\-()]?){9,}/;

/**
 * The contribution note is a free-text field on a PUBLIC surface, so it
 * is a tempting way to publish a phone number and skip the audited
 * reveal flow. Refuse contact shapes (same reasoning as the LLM PII
 * guards).
 */
export function noteHasContactDetails(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

// ── Adaptive empty state ────────────────────────────────────────────────────

export type ProjectHintKind =
  | "tech"
  | "creative"
  | "trade"
  | "food"
  | "beauty"
  | "education"
  | "health"
  | "office"
  | "general";

const HINT_KEYWORDS: Array<[ProjectHintKind, string[]]> = [
  ["tech", ["developer", "software", "programmer", "data", "devops", "it-", "web", "cyber", "network", "ux", "ui", "qa", "systems"]],
  ["creative", ["photograph", "videograph", "graphic", "design", "artist", "writer", "copywriter", "journalist", "music", "animator", "editor", "market", "social-media", "brand"]],
  ["trade", ["welder", "plumber", "electric", "carpenter", "builder", "mechanic", "boilermaker", "fitter", "painter", "tiler", "roofer", "artisan", "technician", "machinist", "installer"]],
  ["food", ["chef", "cook", "baker", "barista", "caterer", "kitchen"]],
  ["beauty", ["hair", "barber", "aesthetic", "nail", "beauty", "makeup"]],
  ["education", ["teacher", "tutor", "lecturer", "trainer", "educator", "facilitator"]],
  ["health", ["nurse", "doctor", "caregiver", "pharmac", "physio", "therapist", "paramedic", "carer"]],
  ["office", ["account", "bookkeep", "admin", "clerk", "manager", "auditor", "hr", "finance", "analyst", "coordinator", "officer", "secretary"]],
];

/**
 * Which empty-state hint fits this profession. Keyword match over the
 * slug + label so 106 professions map onto 9 hints without a hand-kept
 * table that rots every time the taxonomy grows.
 */
export function projectHintKind(profession: string | null | undefined): ProjectHintKind {
  const hay = (profession ?? "").toLowerCase();
  if (!hay) return "general";
  for (const [kind, needles] of HINT_KEYWORDS) {
    if (needles.some((n) => hay.includes(n))) return kind;
  }
  return "general";
}
