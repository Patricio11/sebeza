/**
 * Cookie-consent constants and encoding: the pure half.
 *
 * Split out of consent.ts (a "use server" module) so the CLIENT can
 * write the same cookie synchronously. Why the client writes it at all:
 * the banner used to hide instantly and persist the choice via an async
 * server action, and a navigation cancels in-flight fetches. On a 3G
 * connection to a us-east-1 function, tapping a link right after
 * "Accept all" silently discarded the choice and the banner came back
 * on the next page, asking again for consent the person already gave.
 * Reproduced deterministically with a 3s action delay; on the
 * platform's reference device (low-end Android on 3G) that latency is
 * ordinary.
 *
 * The value is stored percent-encoded, exactly as Next's server-side
 * jar.set() stores it, so both writers produce byte-identical cookies
 * and every reader (server pages, the edge proxy) sees one format.
 */

export const CONSENT_COOKIE_NAME = "sebenza_cookie_consent";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function encodeConsent(analytics: boolean): string {
  return `essential:1|analytics:${analytics ? "1" : "0"}|at:${encodeURIComponent(new Date().toISOString())}`;
}
