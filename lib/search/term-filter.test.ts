import { describe, expect, test } from "vitest";
import { isRealSearchTerm, looksLikeBot } from "./term-filter";

describe("isRealSearchTerm", () => {
  test("accepts what people actually type, typos included", () => {
    for (const t of [
      "chef",
      "Chif",
      "Oracle Fusion",
      "Administrative Clerk",
      "Gardener",
      "welder cape town",
    ]) {
      expect(isRealSearchTerm(t), t).toBe(true);
    }
  });

  test("rejects the SEO search-box placeholder that reached production", () => {
    expect(isRealSearchTerm("{search_term_string}")).toBe(false);
    expect(isRealSearchTerm("{search_term_string}\\\\\\")).toBe(false);
    expect(isRealSearchTerm("${query}")).toBe(false);
    expect(isRealSearchTerm("%s")).toBe(false);
  });

  test("rejects empty, too-short, over-long and escape-laden input", () => {
    expect(isRealSearchTerm(null)).toBe(false);
    expect(isRealSearchTerm("")).toBe(false);
    expect(isRealSearchTerm(" ")).toBe(false);
    expect(isRealSearchTerm("a")).toBe(false);
    expect(isRealSearchTerm("x".repeat(200))).toBe(false);
    expect(isRealSearchTerm("chef<script>")).toBe(false);
    expect(isRealSearchTerm("chef\\path")).toBe(false);
  });
});

describe("looksLikeBot", () => {
  test("catches common crawlers and preview fetchers", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "WhatsApp/2.23",
      "facebookexternalhit/1.1",
      "curl/8.4.0",
      "python-requests/2.31.0",
    ]) {
      expect(looksLikeBot(ua), ua).toBe(true);
    }
  });

  test("leaves real browsers alone", () => {
    expect(
      looksLikeBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
    expect(looksLikeBot(null)).toBe(false);
  });
});
