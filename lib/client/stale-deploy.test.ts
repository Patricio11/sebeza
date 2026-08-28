import { describe, expect, test } from "vitest";

import {
  isStaleServerActionError,
  shouldReloadForNewVersion,
} from "./stale-deploy";

describe("stale deploy detection", () => {
  test("recognises the Next.js missing-action errors", () => {
    expect(
      isStaleServerActionError(
        new Error(
          'Server Action "40fadf798290b64e76b8daeedb95ace412e03a9f13" was not found on the server.',
        ),
      ),
    ).toBe(true);
    expect(
      isStaleServerActionError(
        new Error('Failed to find Server Action "abc".'),
      ),
    ).toBe(true);
    const named = new Error("boom");
    named.name = "UnrecognizedActionError";
    expect(isStaleServerActionError(named)).toBe(true);
  });

  test("ignores ordinary failures", () => {
    expect(isStaleServerActionError(new Error("Profile not found."))).toBe(
      false,
    );
    expect(isStaleServerActionError("network down")).toBe(false);
    expect(isStaleServerActionError(null)).toBe(false);
  });

  test("reloads at most once per minute per tab", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(shouldReloadForNewVersion(storage, 1_000)).toBe(true);
    expect(shouldReloadForNewVersion(storage, 20_000)).toBe(false);
    expect(shouldReloadForNewVersion(storage, 70_000)).toBe(true);
  });

  test("without storage it still allows a reload", () => {
    expect(shouldReloadForNewVersion(null, 0)).toBe(true);
  });
});
