/**
 * Phase 32.3.3 (security remediation)  the E2E escape hatch must fail
 * CLOSED in a deployed environment.
 *
 * `SEBENZA_E2E_HTTP=1` weakens two real controls (admin 2FA
 * hard-require; `upgrade-insecure-requests` in the CSP) so the
 * Playwright suite can drive a production build over plain http. Until
 * Phase 32 the only thing keeping it out of production was a code
 * comment  and the variable was not even in `.env.example`, so an
 * environment audit would never have surfaced it. Anyone with project
 * settings access could have silently disabled admin 2FA platform-wide
 * with no log line and no visible symptom.
 *
 * A crashing deploy is noticed in minutes. A quietly disabled second
 * factor might never be noticed at all  hence: throw.
 */
import { afterEach, describe, expect, it } from "vitest";
import { assertNoTestEscapeHatchesInProduction } from "./env-guard";

const ORIGINAL = {
  hatch: process.env.SEBENZA_E2E_HTTP,
  vercelEnv: process.env.VERCEL_ENV,
};

function setEnv(hatch: string | undefined, vercelEnv: string | undefined) {
  if (hatch === undefined) delete process.env.SEBENZA_E2E_HTTP;
  else process.env.SEBENZA_E2E_HTTP = hatch;
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
}

afterEach(() => {
  setEnv(ORIGINAL.hatch, ORIGINAL.vercelEnv);
});

describe("assertNoTestEscapeHatchesInProduction (Phase 32.3.3)", () => {
  it("THROWS when the hatch is set on a production deployment", () => {
    setEnv("1", "production");
    expect(() => assertNoTestEscapeHatchesInProduction()).toThrow(
      /SEBENZA_E2E_HTTP=1 is set in a deployed environment/,
    );
  });

  it("THROWS on preview deployments too — a preview is still internet-reachable", () => {
    setEnv("1", "preview");
    expect(() => assertNoTestEscapeHatchesInProduction()).toThrow(
      /SEBENZA_E2E_HTTP=1/,
    );
  });

  it("allows the hatch locally, which is the whole point (E2E harness)", () => {
    setEnv("1", undefined);
    expect(() => assertNoTestEscapeHatchesInProduction()).not.toThrow();
    setEnv("1", "development");
    expect(() => assertNoTestEscapeHatchesInProduction()).not.toThrow();
  });

  it("is a no-op when the hatch is unset, whatever the environment", () => {
    setEnv(undefined, "production");
    expect(() => assertNoTestEscapeHatchesInProduction()).not.toThrow();
    setEnv("0", "production");
    expect(() => assertNoTestEscapeHatchesInProduction()).not.toThrow();
  });

  it("names the consequence in the error, not just the variable", () => {
    // Whoever hits this at 2am should not have to go read the source to
    // learn what was actually weakened.
    setEnv("1", "production");
    try {
      assertNoTestEscapeHatchesInProduction();
      throw new Error("should have thrown");
    } catch (e) {
      const msg = String((e as Error).message);
      expect(msg).toMatch(/2FA/);
      expect(msg).toMatch(/upgrade-insecure-requests/);
    }
  });
});
