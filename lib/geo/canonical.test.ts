import { describe, expect, test } from "vitest";

import {
  canonicalCityLabel,
  canonicalProvinceLabel,
  citySlugFor,
  provinceSlugFor,
} from "./canonical";

describe("geo canonical labels", () => {
  test("province: slug, label, and any case all resolve to the label", () => {
    expect(canonicalProvinceLabel("western-cape")).toBe("Western Cape");
    expect(canonicalProvinceLabel("Western Cape")).toBe("Western Cape");
    expect(canonicalProvinceLabel("WESTERN CAPE")).toBe("Western Cape");
    expect(canonicalProvinceLabel("kwazulu-natal")).toBe("KwaZulu-Natal");
    expect(canonicalProvinceLabel("KwaZulu-Natal")).toBe("KwaZulu-Natal");
  });

  test("province: unknown or empty is null, never a guess", () => {
    expect(canonicalProvinceLabel("Narnia")).toBeNull();
    expect(canonicalProvinceLabel("")).toBeNull();
    expect(canonicalProvinceLabel(null)).toBeNull();
  });

  test("province slug from either form", () => {
    expect(provinceSlugFor("Gauteng")).toBe("gauteng");
    expect(provinceSlugFor("gauteng")).toBe("gauteng");
    expect(provinceSlugFor("Nowhere")).toBeNull();
  });

  test("city: slug or label resolves to the label, scoped to the province first", () => {
    expect(canonicalCityLabel("cape-town", "western-cape")).toBe("Cape Town");
    expect(canonicalCityLabel("Cape Town", "Western Cape")).toBe("Cape Town");
    expect(canonicalCityLabel("durban", "KwaZulu-Natal")).toBe("Durban");
    // Resolves even when the province is missing or wrong.
    expect(canonicalCityLabel("johannesburg")).toBe("Johannesburg");
    expect(canonicalCityLabel("johannesburg", "western-cape")).toBe("Johannesburg");
  });

  test("city: unknown free text is kept trimmed; empty stays empty", () => {
    expect(canonicalCityLabel("  Hoedspruit ", "Limpopo")).toBe("Hoedspruit");
    expect(canonicalCityLabel("", "Gauteng")).toBe("");
    expect(canonicalCityLabel(null)).toBe("");
  });

  test("city slug from either form; unknown is null", () => {
    expect(citySlugFor("Cape Town", "Western Cape")).toBe("cape-town");
    expect(citySlugFor("cape-town")).toBe("cape-town");
    expect(citySlugFor("Hoedspruit")).toBeNull();
  });
});
