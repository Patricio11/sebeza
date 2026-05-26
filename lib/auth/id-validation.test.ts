/**
 * Unit fixtures for the Phase 9.16 identity-document validators.
 *
 * These helpers run on both the client (live form feedback) and the
 * server (defence-in-depth in signUpSeeker). If any fixture goes red,
 * the rule meaning has shifted  re-derive the expected outcome from
 * `lib/auth/id-validation.ts` first, do NOT change the value to make
 * the test pass.
 */

import { describe, expect, test } from "vitest";
import {
  validateDob,
  validateSaId,
  validatePassport,
} from "./id-validation";

// ─────────────────────────────────────────────────────────────────────
// validateDob
// ─────────────────────────────────────────────────────────────────────

describe("validateDob()", () => {
  test("rejects empty string", () => {
    expect(validateDob("")).toEqual({
      ok: false,
      message: "Date of birth is required.",
    });
  });

  test("rejects malformed strings", () => {
    expect(validateDob("1990/01/01").ok).toBe(false);
    expect(validateDob("01-01-1990").ok).toBe(false);
    expect(validateDob("1990-1-1").ok).toBe(false);
    expect(validateDob("nineteen ninety").ok).toBe(false);
  });

  test("rejects non-existent calendar dates", () => {
    // 31 February is well-formed numerically but rolls over to March.
    const out = validateDob("1990-02-31");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/doesn't exist/);
  });

  test("rejects ages under 14 (SA Basic Conditions of Employment)", () => {
    const recent = new Date();
    const tooYoung = `${recent.getUTCFullYear() - 10}-01-01`;
    const out = validateDob(tooYoung);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/14/);
  });

  test("rejects ages over 100", () => {
    const out = validateDob("1900-01-01");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/out of range/);
  });

  test("accepts a realistic adult DOB", () => {
    expect(validateDob("1990-06-15")).toEqual({ ok: true });
  });

  test("accepts the boundary  exactly 14", () => {
    const today = new Date();
    const fourteen = `${today.getUTCFullYear() - 14}-${String(
      today.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
    expect(validateDob(fourteen)).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
// validateSaId
// ─────────────────────────────────────────────────────────────────────

describe("validateSaId()", () => {
  // Known-good SA ID: DOB 1990-06-15, sequential 5000, SA citizen,
  // Luhn check digit 4. Hand-verified  do not change without
  // recomputing.
  const VALID_ID = "9006155000084";
  const VALID_DOB = "1990-06-15";

  test("rejects empty / short ID", () => {
    expect(validateSaId("", VALID_DOB).ok).toBe(false);
    expect(validateSaId("12345", VALID_DOB).ok).toBe(false);
  });

  test("rejects non-numeric ID", () => {
    const out = validateSaId("90061550000AB", VALID_DOB);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/13 digits/);
  });

  test("rejects when DOB prefix does not match captured DOB", () => {
    const out = validateSaId(VALID_ID, "1985-06-15");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/first 6 digits/i);
  });

  test("rejects a 13-digit number with a bad Luhn check digit", () => {
    // Flip the last digit  Luhn must fail.
    const bad = VALID_ID.slice(0, 12) + (VALID_ID[12] === "0" ? "1" : "0");
    const out = validateSaId(bad, VALID_DOB);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/check digit/i);
  });

  test("accepts a Luhn-valid ID whose prefix matches the DOB", () => {
    expect(validateSaId(VALID_ID, VALID_DOB)).toEqual({ ok: true });
  });

  test("tolerates whitespace inside the ID string", () => {
    expect(validateSaId(" 9006 1550 00084 ", VALID_DOB)).toEqual({ ok: true });
  });

  test("requires a DOB to cross-check against", () => {
    const out = validateSaId(VALID_ID, "");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/date of birth/i);
  });
});

// ─────────────────────────────────────────────────────────────────────
// validatePassport
// ─────────────────────────────────────────────────────────────────────

describe("validatePassport()", () => {
  test("rejects passports shorter than 6 chars", () => {
    const out = validatePassport("ABC12", "GB");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/6 to 20/);
  });

  test("rejects passports longer than 20 chars", () => {
    const out = validatePassport("A".repeat(21), "GB");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/6 to 20/);
  });

  test("rejects passports with disallowed characters", () => {
    const out = validatePassport("ABC$1234", "GB");
    expect(out.ok).toBe(false);
    if (!out.ok)
      expect(out.message).toMatch(/letters, digits, spaces and hyphens/);
  });

  test("rejects when country code is missing", () => {
    const out = validatePassport("AB123456", "");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/country/i);
  });

  test("rejects an unknown country code", () => {
    const out = validatePassport("AB123456", "XX");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toMatch(/country code/i);
  });

  test("accepts a typical UK passport with country GB", () => {
    expect(validatePassport("123456789", "GB")).toEqual({ ok: true });
  });

  test("accepts a passport with spaces / hyphens (then normalised)", () => {
    expect(validatePassport("AB 12-3456", "ZA")).toEqual({ ok: true });
  });

  test("normalises to uppercase before regex check", () => {
    expect(validatePassport("ab123456", "ZA")).toEqual({ ok: true });
  });
});
