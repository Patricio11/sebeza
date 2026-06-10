/**
 * Phase 12 (Task 12.1) — field-level encryption fixtures (POPIA-First Rule).
 *
 * `encryptField` / `decryptField` protect national IDs, passports, phone
 * numbers and LLM credentials at rest. These fixtures pin the wire contract:
 *
 *   1. Round-trip recovers the exact plaintext (ASCII, unicode, long, empty).
 *   2. Output carries the `v1.` key-id prefix (rotation seam — the
 *      `id-encryption-mandatory` compliance assertion checks the same prefix
 *      on real rows).
 *   3. Each encryption of the same plaintext yields different ciphertext
 *      (random IV — equal ciphertexts would leak equality of IDs).
 *   4. Tampered ciphertext / wrong key / unknown key-id all throw — GCM
 *      auth must fail closed, never return garbage plaintext.
 *
 * Treat failures as security regressions, not refactor noise.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { randomBytes } from "node:crypto";

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");

import { decryptField, encryptField, isEncryptionConfigured } from "./index";

beforeEach(() => {
  process.env.SEBENZA_ENCRYPTION_KEY = KEY_A;
});

afterEach(() => {
  process.env.SEBENZA_ENCRYPTION_KEY = KEY_A;
});

describe("encryptField / decryptField round-trip", () => {
  test("recovers an SA-ID-shaped plaintext exactly", () => {
    const id = "9202204720082";
    expect(decryptField(encryptField(id))).toBe(id);
  });

  test("recovers unicode plaintext exactly", () => {
    const s = "Nkosazana 🇿🇦 Dlamini-Zuma — ID·ñ·ü";
    expect(decryptField(encryptField(s))).toBe(s);
  });

  test("recovers the empty string", () => {
    expect(decryptField(encryptField(""))).toBe("");
  });

  test("recovers a long plaintext (4 KB)", () => {
    const s = "x".repeat(4096);
    expect(decryptField(encryptField(s))).toBe(s);
  });
});

describe("wire format", () => {
  test("payload carries the v1. key-id prefix", () => {
    expect(encryptField("9202204720082")).toMatch(/^v1\./);
  });

  test("same plaintext encrypts to different ciphertexts (random IV)", () => {
    const id = "9202204720082";
    expect(encryptField(id)).not.toBe(encryptField(id));
  });
});

describe("fail-closed behaviour", () => {
  test("tampered ciphertext throws (GCM auth)", () => {
    const payload = encryptField("9202204720082");
    const body = Buffer.from(payload.slice(3), "base64");
    // Flip one bit in the middle of the ciphertext region.
    body[14] = body[14]! ^ 0b00000001;
    const tampered = `v1.${body.toString("base64")}`;
    expect(() => decryptField(tampered)).toThrow();
  });

  test("decrypting with a different key throws", () => {
    const payload = encryptField("9202204720082");
    process.env.SEBENZA_ENCRYPTION_KEY = KEY_B;
    expect(() => decryptField(payload)).toThrow();
  });

  test("unknown key-id prefix throws (rotation fails loudly, not silently)", () => {
    const payload = encryptField("9202204720082");
    const swapped = `v9.${payload.slice(3)}`;
    expect(() => decryptField(swapped)).toThrow(/key id/i);
  });

  test("payload without a key-id prefix throws", () => {
    expect(() => decryptField("bm8tcHJlZml4LWp1c3QtYmFzZTY0")).toThrow(
      /key id/i,
    );
  });

  test("missing env key throws with a setup message, never returns", () => {
    delete process.env.SEBENZA_ENCRYPTION_KEY;
    expect(() => encryptField("x")).toThrow(/SEBENZA_ENCRYPTION_KEY/);
  });

  test("wrong-length key is rejected", () => {
    process.env.SEBENZA_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encryptField("x")).toThrow(/32 bytes/);
  });
});

describe("isEncryptionConfigured", () => {
  test("true with a valid key, false without", () => {
    expect(isEncryptionConfigured()).toBe(true);
    delete process.env.SEBENZA_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
  });
});
