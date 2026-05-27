/**
 * Unit fixtures for the Phase 9.17 invite-token helper.
 *
 * The helper is server-only + reads the signing secret from
 * `SEBENZA_INVITE_SIGNING_SECRET`. Vitest sets the env var inside the
 * test process before `vi.resetModules()` re-imports the helper so the
 * `getSecret()` lookup sees it. We test:
 *
 *   1. Round-trip: sign → verify returns the same inviteId.
 *   2. Expired tokens fail with `expired`.
 *   3. Tampered payload fails with `bad_signature`.
 *   4. Malformed input (missing dot, garbage base64) fails with
 *      `malformed`.
 *   5. Two different secrets produce mutually-unverifiable tokens
 *      (so a leak of one signing key doesn't compromise the other
 *      token kind  password reset, etc.).
 *
 * If a fixture goes red the token contract has shifted  treat as a
 * security-relevant test, not a UX one.
 */

import { describe, expect, test, beforeEach, vi } from "vitest";

const SECRET = "test-signing-secret-9.17-fixtures";
process.env.SEBENZA_INVITE_SIGNING_SECRET = SECRET;

// Re-import per test so secret changes (test 5) take effect.
async function loadHelper() {
  vi.resetModules();
  return await import("./invite-tokens");
}

describe("signInviteToken / verifyInviteToken", () => {
  beforeEach(() => {
    process.env.SEBENZA_INVITE_SIGNING_SECRET = SECRET;
  });

  test("round-trip returns the inviteId", async () => {
    const { signInviteToken, verifyInviteToken } = await loadHelper();
    const id = "inv_test_round_trip_001";
    const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const token = signInviteToken(id, future);
    const out = verifyInviteToken(token);
    expect(out).toEqual({ ok: true, inviteId: id });
  });

  test("expired tokens fail with `expired`", async () => {
    const { signInviteToken, verifyInviteToken } = await loadHelper();
    const past = new Date(Date.now() - 1000);
    const token = signInviteToken("inv_expired_001", past);
    const out = verifyInviteToken(token);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("expired");
  });

  test("tampered payload fails with `bad_signature`", async () => {
    const { signInviteToken, verifyInviteToken } = await loadHelper();
    const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const token = signInviteToken("inv_tamper_001", future);
    const [payload, sig] = token.split(".");
    // Flip a byte in the payload  any change invalidates the HMAC.
    const tampered = `${payload}A.${sig}`;
    const out = verifyInviteToken(tampered);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad_signature");
  });

  test("missing dot fails with `malformed`", async () => {
    const { verifyInviteToken } = await loadHelper();
    expect(verifyInviteToken("nodothere").ok).toBe(false);
    expect(verifyInviteToken("").ok).toBe(false);
  });

  test("garbage base64 fails cleanly (malformed or bad_signature)", async () => {
    const { verifyInviteToken } = await loadHelper();
    const out = verifyInviteToken("###.###");
    expect(out.ok).toBe(false);
  });

  test("different secrets produce mutually-unverifiable tokens", async () => {
    const id = "inv_separate_keys_001";
    const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    process.env.SEBENZA_INVITE_SIGNING_SECRET = "first-secret";
    const a = await loadHelper();
    const tokenA = a.signInviteToken(id, future);

    process.env.SEBENZA_INVITE_SIGNING_SECRET = "second-secret";
    const b = await loadHelper();
    const out = b.verifyInviteToken(tokenA);

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad_signature");
  });
});
