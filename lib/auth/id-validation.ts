/**
 * Phase 9.16  Identity-document validation helpers.
 *
 * Used by both the client-side sign-up form (live inline validation
 * before allowing step-1 advance) and the server-side signUpSeeker
 * action (defence in depth  never trust the client).
 *
 * Three helpers:
 *   - validateDob(iso)              age 14-100
 *   - validateSaId(id, iso)         13 digits + Luhn + DOB cross-check
 *   - validatePassport(num, code)   6-20 chars alphanumeric + valid ISO code
 *
 * All helpers return `{ ok: true } | { ok: false; message: string }`
 * so callers can surface the message to the user verbatim.
 */

import { isValidCountryCode } from "../taxonomy/countries";

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const MIN_AGE = 14; // SA Basic Conditions of Employment Act
const MAX_AGE = 100;

// ─────────────────────────────────────────────────────────────────────
// DOB
// ─────────────────────────────────────────────────────────────────────

export function validateDob(iso: string): ValidationResult {
  if (!iso) return { ok: false, message: "Date of birth is required." };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) {
    return {
      ok: false,
      message: "Date of birth must be a valid date (YYYY-MM-DD).",
    };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, message: "That date doesn't exist." };
  }
  const age = ageInYears(date);
  if (age < MIN_AGE) {
    return {
      ok: false,
      message: `Sebenza is for users aged ${MIN_AGE} and over.`,
    };
  }
  if (age > MAX_AGE) {
    return {
      ok: false,
      message: "Date of birth is out of range  please check the year.",
    };
  }
  return { ok: true };
}

function ageInYears(dob: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
}

// ─────────────────────────────────────────────────────────────────────
// SA ID
// ─────────────────────────────────────────────────────────────────────
// Format: YYMMDD SSSS C A Z
//   YYMMDD = date of birth
//   SSSS   = sex digit + sequential (4 digits; first digit 0-4 = female,
//            5-9 = male  not validated here, we don't store gender)
//   C      = citizenship (0 = SA citizen, 1 = permanent resident)
//   A      = was '8' or '9' on the old book; now always 8
//   Z      = Luhn check digit

/**
 * Validate an SA ID number + cross-check the DOB prefix against the
 * separately-captured DOB. Catches typos at the entry point.
 */
export function validateSaId(idRaw: string, dobIso: string): ValidationResult {
  const id = idRaw.replace(/\s+/g, "");
  if (!/^\d{13}$/.test(id)) {
    return { ok: false, message: "SA ID must be exactly 13 digits." };
  }
  const dobMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso);
  if (!dobMatch) {
    return { ok: false, message: "Enter your date of birth first." };
  }
  const dobYear = Number(dobMatch[1]);
  const dobMonth = Number(dobMatch[2]);
  const dobDay = Number(dobMatch[3]);

  // Cross-check the DOB encoded in the ID prefix against the captured DOB.
  const idYear2 = Number(id.slice(0, 2));
  const idMonth = Number(id.slice(2, 4));
  const idDay = Number(id.slice(4, 6));
  // Resolve 2-digit year: anything > (currentYear % 100) is 19xx; else 20xx.
  // The sliding cutoff handles birthdays before vs after 2000 correctly.
  const currentYearTwoDigit = new Date().getUTCFullYear() % 100;
  const idFullYear =
    idYear2 > currentYearTwoDigit ? 1900 + idYear2 : 2000 + idYear2;
  if (idFullYear !== dobYear || idMonth !== dobMonth || idDay !== dobDay) {
    return {
      ok: false,
      message:
        "The first 6 digits of your SA ID must match your date of birth.",
    };
  }

  if (!luhnValid(id)) {
    return {
      ok: false,
      message: "SA ID check digit is invalid  please verify the number.",
    };
  }

  return { ok: true };
}

/** Luhn check digit validation (mod-10). */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ─────────────────────────────────────────────────────────────────────
// Passport
// ─────────────────────────────────────────────────────────────────────

const PASSPORT_RE = /^[A-Z0-9][A-Z0-9 \-]{4,18}[A-Z0-9]$/i;

export function validatePassport(
  passportRaw: string,
  countryCode: string,
): ValidationResult {
  const passport = passportRaw.trim().toUpperCase();
  if (passport.length < 6 || passport.length > 20) {
    return {
      ok: false,
      message: "Passport number should be 6 to 20 characters.",
    };
  }
  if (!PASSPORT_RE.test(passport)) {
    return {
      ok: false,
      message:
        "Passport number can contain letters, digits, spaces and hyphens only.",
    };
  }
  if (!countryCode) {
    return {
      ok: false,
      message: "Pick the country that issued your passport.",
    };
  }
  if (!isValidCountryCode(countryCode)) {
    return {
      ok: false,
      message: "That country code isn't recognised  pick from the list.",
    };
  }
  return { ok: true };
}
