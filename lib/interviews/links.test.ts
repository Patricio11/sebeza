import { describe, expect, it } from "vitest";
import { buildIcs, formatSaDateTime, googleCalendarUrl } from "./links";

const EVENT = {
  startsAt: new Date("2026-08-30T08:00:00.000Z"), // 10:00 SAST
  durationMinutes: 45,
  title: "Interview: Senior Chef at Ocean Basket",
  location: "12 Long Street, Cape Town",
  description: "Ask for Thandi at reception.\nBring your ID.",
  uid: "int_abc123@sebenzasa.com",
};

describe("googleCalendarUrl", () => {
  it("carries the UTC range and every field", () => {
    const url = new URL(googleCalendarUrl(EVENT));
    expect(url.hostname).toBe("calendar.google.com");
    const p = url.searchParams;
    expect(p.get("dates")).toBe("20260830T080000Z/20260830T084500Z");
    expect(p.get("text")).toBe(EVENT.title);
    expect(p.get("location")).toBe(EVENT.location);
    expect(p.get("details")).toContain("Bring your ID.");
  });
});

describe("buildIcs", () => {
  it("is a valid single-event document with CRLF endings", () => {
    const ics = buildIcs(EVENT);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20260830T080000Z");
    expect(ics).toContain("DTEND:20260830T084500Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // No bare LF anywhere: some parsers hard-reject mixed endings.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("escapes commas, semicolons and newlines in text fields", () => {
    const ics = buildIcs({
      ...EVENT,
      location: "Unit 4; The Works, 9 Juta St",
      description: "Line one\nLine two",
    });
    expect(ics).toContain("LOCATION:Unit 4\\; The Works\\, 9 Juta St");
    expect(ics).toContain("Line one\\nLine two");
  });

  it("folds long lines at 75 octets with space continuations", () => {
    const ics = buildIcs({
      ...EVENT,
      description: "x".repeat(400),
    });
    for (const line of ics.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("\r\n x"); // a folded continuation exists
  });

  it("never splits a multi-byte character across a fold", () => {
    const ics = buildIcs({ ...EVENT, description: "ê".repeat(200) });
    // Re-unfold and confirm the text survives intact.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("ê".repeat(200).replace(/x/g, ""));
  });
});

describe("formatSaDateTime", () => {
  it("renders SA wall-clock regardless of host timezone", () => {
    expect(formatSaDateTime(EVENT.startsAt)).toMatch(/30 Aug 2026, 10:00/);
  });
});
