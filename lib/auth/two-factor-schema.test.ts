/**
 * Better Auth plugin-schema drift detector (migration 0065's lesson).
 *
 * The Phase 32 dependency patch bumped Better Auth to 1.6.25, whose
 * twoFactor plugin model quietly gained `failedVerificationCount` and
 * `lockedUntil`. The Drizzle adapter validates its model against OUR
 * schema on every twoFactor operation, so the missing columns broke 2FA
 * enrolment for every employer and admin, and no test noticed: the E2E
 * harness exempts forced 2FA (SEBENZA_E2E_HTTP) and nothing exercised
 * the enable path. The founder found it in production, mis-reported as
 * "wrong password" by the old catch-all error mapping.
 *
 * This test closes the class: it asks the INSTALLED plugin for its model
 * and asserts every field has a column in db/schema.ts. When a future
 * upgrade adds a field, this fails at `npm run test` time with the exact
 * field name, instead of in an admin's face at enrolment time.
 */
import { describe, expect, it } from "vitest";
import { twoFactor as twoFactorPlugin } from "better-auth/plugins/two-factor";
import { appUser, twoFactor } from "@/db/schema";

const plugin = twoFactorPlugin({});

describe("Better Auth twoFactor plugin schema ↔ db/schema.ts", () => {
  it("every twoFactor model field has a Drizzle column", () => {
    const fields = Object.keys(plugin.schema?.twoFactor?.fields ?? {});
    expect(fields.length).toBeGreaterThan(0);
    const missing = fields.filter(
      (f) => !(f in twoFactor),
    );
    expect(missing, `add these to db/schema.ts twoFactor + a migration: ${missing.join(", ")}`).toEqual([]);
  });

  it("every user model field has a Drizzle column on app_user", () => {
    const fields = Object.keys(plugin.schema?.user?.fields ?? {});
    const missing = fields.filter((f) => !(f in appUser));
    expect(missing, `add these to db/schema.ts appUser + a migration: ${missing.join(", ")}`).toEqual([]);
  });
});
