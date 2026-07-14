/**
 * Phase 12 (Task 12.1)  consent state-machine fixtures (POPIA-First Rule).
 *
 * Pins two contracts:
 *
 *   1. The purpose catalogue. Server actions, the privacy page, and three
 *      compliance assertions key on these exact strings; adding/renaming a
 *      purpose must be a deliberate act (this fixture forces the diff).
 *   2. `isSearchable`  a profile is searchable ONLY while `searchability`
 *      is in state `granted`. Revoked ≠ none ≠ granted; every other purpose
 *      is non-degrading and must have no effect on searchability.
 */

import { describe, expect, test } from "vitest";
import {
  CONSENT_PURPOSES,
  isSearchable,
  REQUIRED_FOR_SEARCHABILITY,
  type ConsentRecord,
} from "./index";

function rec(
  purpose: ConsentRecord["purpose"],
  state: ConsentRecord["state"],
): ConsentRecord {
  return {
    purpose,
    state,
    version: "test-v1",
    grantedAt: state === "granted" ? "2026-06-01T00:00:00Z" : null,
    revokedAt: state === "revoked" ? "2026-06-02T00:00:00Z" : null,
  };
}

describe("consent purpose catalogue", () => {
  test("contains exactly the nine known purposes (order-insensitive)", () => {
    expect([...CONSENT_PURPOSES].sort()).toEqual(
      [
        "analytics_aggregate",
        "contact_reveal",
        "document_sharing",
        "messaging_channel_sms",
        "messaging_channel_whatsapp",
        "outcomes_research",
        "searchability",
        "vacancy_matching",
        // Phase 25.4  opt-in platform announcements over SMS.
        "announcements",
      ].sort(),
    );
  });

  test("searchability is the only purpose required for search visibility", () => {
    expect(REQUIRED_FOR_SEARCHABILITY).toEqual(["searchability"]);
  });
});

describe("isSearchable", () => {
  test("granted searchability → searchable", () => {
    expect(isSearchable([rec("searchability", "granted")])).toBe(true);
  });

  test("no records at all → NOT searchable (none ≠ granted)", () => {
    expect(isSearchable([])).toBe(false);
  });

  test("revoked searchability → NOT searchable (revoke is effective immediately)", () => {
    expect(isSearchable([rec("searchability", "revoked")])).toBe(false);
  });

  test("explicit none state → NOT searchable", () => {
    expect(isSearchable([rec("searchability", "none")])).toBe(false);
  });

  test("every other purpose granted without searchability → NOT searchable", () => {
    const everythingElse = CONSENT_PURPOSES.filter(
      (p) => p !== "searchability",
    ).map((p) => rec(p, "granted"));
    expect(isSearchable(everythingElse)).toBe(false);
  });

  test("revoke → regrant lifecycle: latest granted record restores visibility", () => {
    expect(
      isSearchable([
        rec("searchability", "revoked"),
        rec("searchability", "granted"),
      ]),
    ).toBe(true);
  });

  test("optional purposes are non-degrading: revoking them never affects searchability", () => {
    expect(
      isSearchable([
        rec("searchability", "granted"),
        rec("outcomes_research", "revoked"),
        rec("vacancy_matching", "revoked"),
        rec("contact_reveal", "revoked"),
      ]),
    ).toBe(true);
  });
});
