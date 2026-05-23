/**
 * South African ID number validation (Phase 3).
 *
 * Format: YYMMDDSSSSCAZ (13 digits)
 *   YYMMDD  birth date
 *   SSSS    sequence (4 digits; 0000–4999 female, 5000–9999 male)
 *   C       citizenship (0 = SA citizen, 1 = permanent resident)
 *   A       historical apartheid race classifier (now always 8 or 9)
 *   Z       Luhn checksum
 *
 * We validate format + checksum only. The birth-date sanity (e.g. not in the
 * future) is intentionally light  people lie about DOB on every form ever,
 * and Home Affairs verification (Phase 8) is the real check.
 */

const ID_LENGTH = 13;
const DIGITS = /^\d{13}$/;

export interface IdValidationResult {
  ok: boolean;
  /** Stripped, digits-only form (spaces removed). */
  normalised: string;
  reason?:
    | "wrong_length"
    | "not_digits"
    | "bad_date"
    | "bad_checksum";
}

export function validateSaIdNumber(input: string): IdValidationResult {
  const normalised = input.replace(/\s+/g, "");
  if (normalised.length !== ID_LENGTH) {
    return { ok: false, normalised, reason: "wrong_length" };
  }
  if (!DIGITS.test(normalised)) {
    return { ok: false, normalised, reason: "not_digits" };
  }
  // Light date check  month 01-12, day 01-31. No leap-year strictness.
  const month = Number(normalised.slice(2, 4));
  const day = Number(normalised.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, normalised, reason: "bad_date" };
  }
  if (!luhnOk(normalised)) {
    return { ok: false, normalised, reason: "bad_checksum" };
  }
  return { ok: true, normalised };
}

/** SA ID uses a Luhn-like algorithm on 13 digits. */
function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    if (i % 2 === 0) {
      // Odd-position digits (1st, 3rd, …) added as-is
      sum += d;
    } else {
      // Even-position digits doubled; if result > 9, subtract 9
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  return sum % 10 === 0;
}
