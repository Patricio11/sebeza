/**
 * Every platform setting must be visible and reachable from ONE place.
 *
 * Founder decision, 2026-08-21: "all flags in one place is better and
 * clear, so don't miss nothing." Before this, four dark-shipped feature
 * flags (selfie verification, Self Apply, seeker projects, web push)
 * had no switch anywhere in the product, and the SMS card on
 * Integrations pointed at a settings row that did not exist. A flag you
 * cannot find is not a launch switch, it is a wall.
 *
 * Rule: every SettingKey appears on /admin/settings. Plain flags get a
 * real toggle; ack-gated ones get a "managed" row that shows state and
 * links to their acknowledgement flow (a bypassable safety ack is not
 * an ack). Either way the key string must be present in SettingsForm,
 * so this test fails the moment a new key ships without a row.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const settingsSrc = readFileSync(
  path.join(root, "lib/admin/settings.ts"),
  "utf8",
);
const formSrc = readFileSync(
  path.join(root, "components/feature/admin/SettingsForm.tsx"),
  "utf8",
);

const KEYS = Array.from(settingsSrc.matchAll(/\|\s+"([a-z0-9_]+)"/g)).map(
  (m) => m[1]!,
);

describe("one place for every platform setting", () => {
  it("found a plausible number of setting keys", () => {
    expect(KEYS.length).toBeGreaterThan(20);
  });

  it("every key has a row on /admin/settings", () => {
    const missing = KEYS.filter((k) => !formSrc.includes(`"${k}"`));
    expect(
      missing,
      `settings with no row on /admin/settings: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
