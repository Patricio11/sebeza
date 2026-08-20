/**
 * Phase 35  guards on the push payload.
 *
 * The important one is the path check. A push payload is the only place
 * in the product where a string from the database becomes a navigation
 * target inside the service worker, so "same-origin relative path or
 * nothing" is a security property, not a tidiness preference.
 */
import { describe, it, expect } from "vitest";
import {
  buildPushPayload,
  deviceLabelFrom,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
} from "./config";

describe("buildPushPayload", () => {
  it("keeps a normal relative path", () => {
    const p = buildPushPayload({
      title: "Sebenza",
      body: "A verified employer flagged you for a specific role",
      path: "/dashboard/invitations/inv_123",
      tag: "vacancy.invite",
    });
    expect(p.path).toBe("/dashboard/invitations/inv_123");
    expect(p.tag).toBe("vacancy.invite");
  });

  it("refuses to navigate off-site", () => {
    for (const hostile of [
      "https://evil.example/phish",
      "//evil.example/phish",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "dashboard/invitations", // no leading slash: not a rooted path
    ]) {
      expect(
        buildPushPayload({
          title: "t",
          body: "b",
          path: hostile,
          tag: "x",
        }).path,
      ).toBe("/dashboard");
    }
  });

  it("clamps title and body so the tray does not truncate mid-thought", () => {
    const p = buildPushPayload({
      title: "x".repeat(200),
      body: "word ".repeat(200),
      path: "/dashboard",
      tag: "x",
    });
    expect(p.title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
    expect(p.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
    expect(p.body.endsWith("…")).toBe(true);
  });

  it("collapses whitespace rather than shipping ragged copy", () => {
    expect(
      buildPushPayload({
        title: "  Sebenza\n\tsays  ",
        body: "a   b",
        path: "/dashboard",
        tag: "x",
      }),
    ).toMatchObject({ title: "Sebenza says", body: "a b" });
  });
});

describe("deviceLabelFrom", () => {
  it("reduces a user-agent to a browser and a platform, and nothing else", () => {
    const label = deviceLabelFrom(
      "Mozilla/5.0 (Linux; Android 13; SM-A055F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    );
    // The point is what is NOT retained: no version, no device model.
    expect(label).toBe("Chrome on Android");
    expect(label).not.toMatch(/SM-A055F|120|537/);
  });

  it("handles an unknown agent and a missing one", () => {
    expect(deviceLabelFrom("some-random-agent")).toBe("Browser");
    expect(deviceLabelFrom(null)).toBeNull();
  });
});
