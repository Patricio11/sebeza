import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-internal-path";

const FALLBACK = "/employer/vacancies";

describe("safeInternalPath (Phase 29.5 open-redirect guard)", () => {
  it("passes ordinary internal paths through", () => {
    expect(safeInternalPath("/search", FALLBACK)).toBe("/search");
    expect(
      safeInternalPath("/search?q=chef&province=gauteng&invite=1", FALLBACK),
    ).toBe("/search?q=chef&province=gauteng&invite=1");
  });

  it("falls back on empty / missing values", () => {
    expect(safeInternalPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects absolute URLs and scheme smuggling", () => {
    expect(safeInternalPath("https://evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("/x?u=https://evil.example", FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeInternalPath("//evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("/\\evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("\\\\evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects header-splitting payloads", () => {
    expect(safeInternalPath("/x\r\nSet-Cookie: a=b", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("/x\npwned", FALLBACK)).toBe(FALLBACK);
  });
});

/**
 * Phase 32.2.6  the payloads that were accepted by the old
 * `next.startsWith("/")` guard in the four auth redirect sites. These
 * are protocol-relative: a browser resolves `//evil.example` against
 * the current scheme and navigates OFF-SITE, so a freshly-authenticated
 * user could be dropped on an attacker's page with a trustworthy
 * referrer chain.
 */
describe("Phase 32.2.6, auth ?next= payloads", () => {
  const HOME = "/dashboard";
  const attacks = [
    "//evil.example",
    "//evil.example/sebenza-login",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/x\r\nLocation: https://evil.example",
  ];

  for (const payload of attacks) {
    it(`refuses ${JSON.stringify(payload)} and falls back to the role home`, () => {
      expect(safeInternalPath(payload, HOME)).toBe(HOME);
    });
  }

  it("still allows the genuine in-app destinations the flow needs", () => {
    expect(safeInternalPath("/employer/vacancies", HOME)).toBe(
      "/employer/vacancies",
    );
    expect(safeInternalPath("/search?q=chef&invite=1", HOME)).toBe(
      "/search?q=chef&invite=1",
    );
  });
});
