/**
 * Add-to-calendar, the universal way.
 *
 * A Google Calendar template URL plus an RFC 5545 .ics builder, so one
 * tap lands the interview in Google / Outlook / Apple with NO OAuth, no
 * tokens, and nothing shared with any calendar vendor except what the
 * person chooses by clicking. A two-way sync would need an
 * Integrations-hub project with its own DPA; this needs a URL.
 *
 * Pure module: no db, no server-only, unit-testable. Times in and out
 * are UTC; calendar clients convert to the viewer's zone themselves.
 */

export interface CalendarEvent {
  /** UTC start. */
  startsAt: Date;
  durationMinutes: number;
  title: string;
  /** Address, meeting link, or phone note. */
  location: string;
  /** Free text; newlines allowed. */
  description: string;
  /** Stable id so re-imports update rather than duplicate. */
  uid: string;
}

/** 20260830T100000Z, the basic UTC form both formats want. */
function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function endOf(e: CalendarEvent): Date {
  return new Date(e.startsAt.getTime() + e.durationMinutes * 60_000);
}

/** The calendar.google.com render-template link. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(e.startsAt)}/${utcStamp(endOf(e))}`,
    details: e.description,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** RFC 5545 text escaping: backslash first, then the specials. */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold lines at 75 octets per the RFC. Calendar parsers genuinely
 * reject or truncate unfolded long lines, and meeting links plus
 * instructions get long. Continuation lines start with one space.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // Take up to 74 bytes (75 minus the leading space on continuations)
    // but never split inside a UTF-8 sequence.
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1;
    }
    out.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n ");
}

/** A complete single-event VCALENDAR document. */
export function buildIcs(e: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sebenza//Interviews//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(e.uid)}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(e.startsAt)}`,
    `DTEND:${utcStamp(endOf(e))}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `LOCATION:${icsEscape(e.location)}`,
    `DESCRIPTION:${icsEscape(e.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Renders a UTC instant as SA wall-clock, e.g. "Sat 30 Aug 2026, 10:00". */
export function formatSaDateTime(d: Date, locale = "en-ZA"): string {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(d);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  }).format(d);
  return `${date}, ${time}`;
}
