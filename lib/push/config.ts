/**
 * Phase 35  Web Push: the pure half.
 *
 * No `"use server"`, no `server-only`: constants and payload shaping
 * that both the sender and the tests need. Keeping the caps here (and
 * not in the Server Action module) is the same rule the project already
 * follows elsewhere: a `"use server"` file may only export async
 * functions.
 */

/** A push notification renders on a LOCK SCREEN, where anyone holding
 *  the phone can read it. So the payload carries no personal detail:
 *  no employer name, no salary, no candidate name, no decline reason.
 *  It says that something happened and where to tap. The detail lives
 *  behind authentication, which is exactly where the Redaction Rule
 *  wants it. */
export const PUSH_TITLE_MAX = 60;
export const PUSH_BODY_MAX = 120;

/** Push services reject large payloads outright; well under any limit. */
export const PUSH_PAYLOAD_BYTES_MAX = 3000;

/** Consecutive failures before a subscription is pruned. A phone that
 *  is simply off for a week must not be dropped, but a browser profile
 *  that was deleted should not be retried forever. */
export const PUSH_FAILURE_THRESHOLD = 5;

/** VAPID requires a contact for the push service to reach us if our
 *  sends misbehave. Overridable from the admin config. */
export const PUSH_DEFAULT_SUBJECT = "mailto:info@sebenzasa.com";

export interface PushPayload {
  title: string;
  body: string;
  /** Relative in-app path the tap opens. Never an absolute URL: the
   *  service worker resolves it against our own origin, so a poisoned
   *  payload cannot navigate the user off-site. */
  path: string;
  /** Collapse key. A second notification with the same tag replaces the
   *  first in the tray instead of stacking, so five invitations do not
   *  bury the phone. */
  tag: string;
}

function clamp(value: string, max: number): string {
  const s = value.trim().replace(/\s+/g, " ");
  if (s.length <= max) return s;
  // Cut on a word boundary where one is available in the last quarter,
  // so the ellipsis does not land mid-word.
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.75 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Build the wire payload. Enforces the caps and, most importantly,
 * refuses anything that is not a same-origin relative path.
 */
export function buildPushPayload(input: {
  title: string;
  body: string;
  path: string;
  tag: string;
}): PushPayload {
  const path =
    input.path.startsWith("/") && !input.path.startsWith("//")
      ? input.path
      : "/dashboard";
  return {
    title: clamp(input.title, PUSH_TITLE_MAX),
    body: clamp(input.body, PUSH_BODY_MAX),
    path,
    tag: input.tag,
  };
}

/**
 * A coarse device label from a user-agent string, for the "your
 * devices" list. Deliberately lossy: browser family + platform family
 * and nothing else. We do not store the raw user-agent, which is a
 * fingerprinting surface we have no use for.
 */
export function deviceLabelFrom(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("opr/") || ua.includes("opera")
      ? "Opera"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("chrome") || ua.includes("crios")
          ? "Chrome"
          : ua.includes("safari")
            ? "Safari"
            : "Browser";
  const platform = ua.includes("android")
    ? "Android"
    : ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")
      ? "iOS"
      : ua.includes("windows")
        ? "Windows"
        : ua.includes("mac os")
          ? "Mac"
          : ua.includes("linux")
            ? "Linux"
            : null;
  return platform ? `${browser} on ${platform}` : browser;
}
