import { describe, expect, test } from "vitest";
import {
  normaliseProjectUrl,
  linkHostname,
  noteHasContactDetails,
  projectHintKind,
} from "./project-links";

describe("normaliseProjectUrl", () => {
  test("empty is allowed (photo-only projects are first-class)", () => {
    expect(normaliseProjectUrl("")).toEqual({ ok: true, url: null });
    expect(normaliseProjectUrl(null)).toEqual({ ok: true, url: null });
  });

  test("bare hostnames gain https", () => {
    const r = normaliseProjectUrl("github.com/andile/shop");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe("https://github.com/andile/shop");
  });

  test("keeps an explicit http(s) URL", () => {
    const r = normaliseProjectUrl("http://example.co.za/work");
    expect(r.ok && r.url).toBe("http://example.co.za/work");
  });

  test.each([
    ["javascript:alert(1)", /isn't allowed/],
    ["data:text/html,<script>", /isn't allowed/],
    ["mailto:me@example.com", /reach you through Sebenza/],
    ["tel:+27821234567", /reach you through Sebenza/],
  ])("refuses %s", (input, message) => {
    const r = normaliseProjectUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(message);
  });

  test("refuses nonsense and over-long links", () => {
    expect(normaliseProjectUrl("not a url").ok).toBe(false);
    expect(normaliseProjectUrl("localhost").ok).toBe(false);
    expect(normaliseProjectUrl(`https://x.co/${"a".repeat(320)}`).ok).toBe(false);
  });
});

describe("linkHostname", () => {
  test("strips www for display", () => {
    expect(linkHostname("https://www.behance.net/user")).toBe("behance.net");
    expect(linkHostname("https://github.com/x")).toBe("github.com");
  });
});

describe("noteHasContactDetails", () => {
  test("catches emails and SA phone shapes", () => {
    expect(noteHasContactDetails("Reach me at me@example.co.za")).toBe(true);
    expect(noteHasContactDetails("Call 082 123 4567")).toBe(true);
    expect(noteHasContactDetails("+27 82 123 4567")).toBe(true);
  });

  test("does not trip on years or team sizes", () => {
    expect(
      noteHasContactDetails("Built in 2023 with a team of 4, ran until 2025."),
    ).toBe(false);
    expect(noteHasContactDetails("I did the backend and payments.")).toBe(false);
  });
});

describe("projectHintKind", () => {
  test.each([
    ["software-developer", "tech"],
    ["Web Developer", "tech"],
    ["photographer", "creative"],
    ["graphic-designer", "creative"],
    ["welder", "trade"],
    ["aircon-technician", "trade"],
    ["chef", "food"],
    ["hairdresser", "beauty"],
    ["teacher", "education"],
    ["nurse", "health"],
    ["bookkeeper", "office"],
    ["", "general"],
    ["farm-worker", "general"],
  ])("%s → %s", (profession, expected) => {
    expect(projectHintKind(profession)).toBe(expected);
  });
});
