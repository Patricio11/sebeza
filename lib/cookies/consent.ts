"use server";

/**
 * Phase 9  Cookie consent persistence.
 *
 * One first-party cookie (`sebenza_cookie_consent`) holds the user's
 * choice. Two scopes: essential (always on, can't be opted out) and
 * analytics (default off, user-toggled).
 *
 * Shape: `essential:1|analytics:1` (compact, easy to parse without
 * JSON.parse in the proxy edge runtime).
 */

import { cookies as nextCookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "sebenza_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ConsentScope = "essential" | "analytics";

export interface CookieConsentState {
  essential: true; // Always granted  site doesn't work without it.
  analytics: boolean;
  /** ISO timestamp of when the choice was made. */
  recordedAt: string | null;
}

function encode(state: Pick<CookieConsentState, "analytics">): string {
  return `essential:1|analytics:${state.analytics ? "1" : "0"}|at:${encodeURIComponent(new Date().toISOString())}`;
}

function decode(raw: string | undefined): CookieConsentState {
  if (!raw) {
    return { essential: true, analytics: false, recordedAt: null };
  }
  const parts = Object.fromEntries(
    raw.split("|").map((kv) => {
      const [k, v] = kv.split(":");
      return [k ?? "", v ?? ""];
    }),
  );
  return {
    essential: true,
    analytics: parts.analytics === "1",
    recordedAt: parts.at ? decodeURIComponent(parts.at) : null,
  };
}

export async function readCookieConsent(): Promise<CookieConsentState> {
  const jar = await nextCookies();
  return decode(jar.get(COOKIE_NAME)?.value);
}

export async function setCookieConsent(input: {
  analytics: boolean;
}): Promise<{ ok: true }> {
  const jar = await nextCookies();
  jar.set(COOKIE_NAME, encode({ analytics: input.analytics }), {
    path: "/",
    httpOnly: false, // client needs to read it to suppress the banner on render
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });
  // Banner display is server-rendered, so layout needs to re-render
  // once the cookie is set.
  revalidatePath("/", "layout");
  return { ok: true };
}
