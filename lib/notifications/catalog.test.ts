/**
 * Phase 12 (Task 12.1)  notification catalogue contract fixtures.
 *
 * The catalogue is the single source of truth for audience, channel
 * defaults, and dedupe windows. `createNotification` trusts it blindly, so
 * a malformed entry ships straight to users. Generic fixtures assert every
 * entry's shape; pinned fixtures lock the handful of values that earlier
 * phases documented as deliberate decisions (and that a well-meaning edit
 * could quietly flip).
 */

import { describe, expect, test } from "vitest";
import {
  NOTIFICATION_CATALOG,
  type NotificationAudience,
} from "./catalog";

const AUDIENCES: NotificationAudience[] = [
  "seeker",
  "self",
  "org_members",
  "all_admins",
];

const entries = Object.entries(NOTIFICATION_CATALOG);

describe("every catalogue entry is well-formed", () => {
  test("catalogue is substantial (sanity floor, not an exact pin)", () => {
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  test.each(entries)("%s", (_kind, meta) => {
    expect(AUDIENCES).toContain(meta.audience);
    expect(typeof meta.defaultInApp).toBe("boolean");
    expect(typeof meta.defaultEmail).toBe("boolean");
    expect(meta.label.trim().length).toBeGreaterThan(0);
    expect(meta.description.trim().length).toBeGreaterThan(0);
    expect(Number.isInteger(meta.dedupeWindowSeconds)).toBe(true);
    expect(meta.dedupeWindowSeconds).toBeGreaterThanOrEqual(0);
  });

  test("kind names follow the dot-namespace convention", () => {
    for (const [kind] of entries) {
      expect(kind).toMatch(/^[a-z0-9_]+(\.[a-z0-9_-]+)+$/);
    }
  });
});

describe("pinned decisions from earlier phases", () => {
  test("profile.viewed: off by default + 24h dedupe (Phase 7.6 'calm bell')", () => {
    const m = NOTIFICATION_CATALOG["profile.viewed"];
    expect(m.defaultInApp).toBe(false);
    expect(m.dedupeWindowSeconds).toBe(24 * 60 * 60);
    expect(m.audience).toBe("seeker");
  });

  test("contact.revealed: on by default, never deduped (every reveal is its own event)", () => {
    const m = NOTIFICATION_CATALOG["contact.revealed"];
    expect(m.defaultInApp).toBe(true);
    expect(m.dedupeWindowSeconds).toBe(0);
    expect(m.audience).toBe("seeker");
  });

  test("placement.confirmed: on by default, never deduped (Placement-Truth)", () => {
    const m = NOTIFICATION_CATALOG["placement.confirmed"];
    expect(m.defaultInApp).toBe(true);
    expect(m.dedupeWindowSeconds).toBe(0);
  });

  test("suspension/restore notify the affected user, role-agnostic", () => {
    expect(NOTIFICATION_CATALOG["account.suspended"].audience).toBe("self");
    expect(NOTIFICATION_CATALOG["account.restored"].audience).toBe("self");
  });

  test("surveillance honesty: no shortlist-add kind exists (DPIA R3)", () => {
    const kinds = entries.map(([k]) => k);
    expect(kinds.filter((k) => k.includes("shortlist"))).toEqual([]);
  });
});
