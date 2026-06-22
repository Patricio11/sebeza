/**
 * Phase 12 (Task 12.1)  vacancy-location display fixtures (Phase 13.9).
 *
 * `formatVacancyLocation` is the single source of truth for eight render
 * sites; the gov-side bucket helpers keep null-province vacancies in their
 * own "National / remote" lane (never silently dropped, never
 * double-counted). Exact separator glyphs in the "Any province" labels are
 * editorial-managed, so fixtures assert structure (prefix + mode words)
 * rather than pinning the glyph.
 */

import { describe, expect, test } from "vitest";
import {
  formatVacancyLocation,
  isNationalRemoteBucket,
  NATIONAL_REMOTE_BUCKET,
  nationalRemoteBucketLabel,
  vacancyProvinceBucket,
} from "./vacancies-display";

describe("formatVacancyLocation  located vacancies", () => {
  test("city + province renders 'City, Province'", () => {
    expect(
      formatVacancyLocation({
        provinceSlug: "western-cape",
        citySlug: "cape-town",
        workAvailability: ["full_time"],
      }),
    ).toBe("Cape Town, Western Cape");
  });

  test("province only renders the province label", () => {
    expect(
      formatVacancyLocation({
        provinceSlug: "gauteng",
        citySlug: null,
        workAvailability: ["full_time"],
      }),
    ).toBe("Gauteng");
  });

  test("unknown slugs fall back to the raw slug, never crash", () => {
    expect(
      formatVacancyLocation({
        provinceSlug: "atlantis",
        citySlug: "lost-city",
        workAvailability: [],
      }),
    ).toBe("lost-city, atlantis");
  });
});

describe("formatVacancyLocation  any-province (null) vacancies", () => {
  test("remote-only: 'Any province … Remote'", () => {
    const s = formatVacancyLocation({
      provinceSlug: null,
      citySlug: null,
      workAvailability: ["remote"],
    });
    expect(s.startsWith("Any province")).toBe(true);
    expect(s).toContain("Remote");
    expect(s).not.toContain("Hybrid");
  });

  test("hybrid-only: 'Any province … Hybrid'", () => {
    const s = formatVacancyLocation({
      provinceSlug: null,
      citySlug: null,
      workAvailability: ["hybrid"],
    });
    expect(s.startsWith("Any province")).toBe(true);
    expect(s).toContain("Hybrid");
    expect(s).not.toContain("Remote");
  });

  test("remote + hybrid: both modes surface, separated by ' / '", () => {
    const s = formatVacancyLocation({
      provinceSlug: null,
      citySlug: null,
      workAvailability: ["remote", "hybrid", "full_time"],
    });
    expect(s).toContain("Remote / Hybrid");
  });

  test("neither mode (shouldn't happen  server validation gates it): honest fallback", () => {
    expect(
      formatVacancyLocation({
        provinceSlug: null,
        citySlug: null,
        workAvailability: ["full_time"],
      }),
    ).toBe("Any province");
  });

  test("never says 'anywhere'  the platform is SA-bounded (D7)", () => {
    const s = formatVacancyLocation({
      provinceSlug: null,
      citySlug: null,
      workAvailability: ["remote"],
    });
    expect(s.toLowerCase()).not.toContain("anywhere");
  });
});

describe("gov-side national/remote bucket helpers (Phase 13.9 D5)", () => {
  test("null province maps to the sentinel bucket; real provinces pass through", () => {
    expect(vacancyProvinceBucket(null)).toBe(NATIONAL_REMOTE_BUCKET);
    expect(vacancyProvinceBucket("gauteng")).toBe("gauteng");
  });

  test("sentinel detection is exact", () => {
    expect(isNationalRemoteBucket(NATIONAL_REMOTE_BUCKET)).toBe(true);
    expect(isNationalRemoteBucket("gauteng")).toBe(false);
    expect(isNationalRemoteBucket("")).toBe(false);
  });

  test("sentinel can never collide with a real province slug shape", () => {
    expect(NATIONAL_REMOTE_BUCKET).toBe("national-remote");
  });

  test("display label is CSV-friendly plain text", () => {
    expect(nationalRemoteBucketLabel()).toBe("National / remote");
  });
});
