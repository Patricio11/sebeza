import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Relative-time formatter (used by StatusChip + freshness UIs).
// Locale-aware via Intl.RelativeTimeFormat  no extra runtime cost.
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 30, unit: "day" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTime(
  iso: string,
  locale: string = "en",
  reference: Date = new Date(),
): string {
  const date = new Date(iso);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (date.getTime() - reference.getTime()) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "year");
}

export function daysSince(iso: string, reference: Date = new Date()): number {
  return Math.floor(
    (reference.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Hydration-safe date display (admin audit finding, 2026-08-15).
 *
 * `date.toLocaleDateString()` with NO locale argument formats with the
 * runtime's default ICU locale, and the server's default and the
 * visitor's browser default can disagree - which is a React #418
 * hydration text mismatch on any server-rendered client component
 * (found live on /admin/taxonomy/suggestions by the admin smoke walk).
 * Explicit locale + timezone + options make the output identical on
 * both sides. en-ZA + Johannesburg is the platform's home context;
 * pass a locale explicitly where a translated surface needs one.
 */
const ZA_DATE = new Intl.DateTimeFormat("en-ZA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Africa/Johannesburg",
});

export function formatDateZA(iso: string | Date): string {
  return ZA_DATE.format(typeof iso === "string" ? new Date(iso) : iso);
}
