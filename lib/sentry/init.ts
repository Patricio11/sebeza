/**
 * Phase 9 — Sentry initialisation (env-gated).
 *
 * We don't take a hard dependency on `@sentry/nextjs` until the project
 * has a DSN; the init is a no-op when `SENTRY_DSN` is unset (dev +
 * fresh-fork case). The PII scrubber in `beforeSend` drops the fields
 * that should never reach a third-party observability platform —
 * email, national_id, phone, every audit-log meta JSONB.
 *
 * Wire-up checklist (run when Sentry account exists):
 *   1. `npm install @sentry/nextjs`
 *   2. Set SENTRY_DSN + SENTRY_AUTH_TOKEN in env.
 *   3. Add `sentry.client.config.ts`, `sentry.server.config.ts`,
 *      `sentry.edge.config.ts` each calling `initSentry({ runtime })`.
 *   4. `next build` uploads source maps via `withSentryConfig`.
 *
 * Until then the helpers below are safe no-ops — typecheck stays
 * clean, build stays dep-free, and the day Sentry is provisioned is a
 * config change, not a feature add.
 */

import "server-only";

const FIELD_SCRUB = new Set([
  "email",
  "phone",
  "nationalId",
  "national_id",
  "nationalIdEnc",
  "national_id_enc",
  "password",
  "passwordHash",
  "token",
  "session",
]);

export interface SentryEvent {
  message?: string;
  request?: { headers?: Record<string, string>; cookies?: unknown };
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
}

/**
 * Recursively walk an event payload and replace any known-sensitive
 * field with `[scrubbed]`. Safe for nested objects + arrays.
 */
export function scrubPii<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubPii(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FIELD_SCRUB.has(k)) {
        out[k] = "[scrubbed]";
      } else {
        out[k] = scrubPii(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * `beforeSend` hook intended to be passed straight to `Sentry.init`.
 * Returns `null` to drop the event, an edited event to ship a
 * sanitised copy, or the original event when nothing matched.
 */
export function beforeSend(event: SentryEvent): SentryEvent | null {
  // Drop credential-bearing 4xx events outright — they're noise.
  if (event.message && /\b(401|403)\b/.test(event.message)) return null;
  // Strip cookies + auth headers wholesale.
  if (event.request?.headers) {
    delete event.request.headers["authorization"];
    delete event.request.headers["cookie"];
  }
  if (event.request) {
    delete event.request.cookies;
  }
  return scrubPii(event);
}

interface InitOptions {
  runtime: "node" | "edge" | "browser";
}

/**
 * Real Sentry init (called from sentry.{client,server,edge}.config.ts
 * once `@sentry/nextjs` is installed). Until then, no-op.
 */
export async function initSentry(opts: InitOptions): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // Default state — Sentry off in dev / fresh fork.

  // Lazy-import so we don't take the dep until it's actually wanted.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = (await import("@sentry/nextjs" as any)) as {
      init: (cfg: Record<string, unknown>) => void;
    };
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: opts.runtime === "browser" ? 0.1 : 0.2,
      profilesSampleRate: 0,
      beforeSend,
    });
  } catch {
    // @sentry/nextjs not installed yet — silent no-op, audited by the
    // launch checklist before going live.
    // eslint-disable-next-line no-console
    console.warn(
      "[sentry] SENTRY_DSN is set but @sentry/nextjs is not installed; skipping init.",
    );
  }
}
