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
