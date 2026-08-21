/**
 * The black-box recorder.
 *
 * Production strips error messages from the browser and keeps them only
 * in Vercel's function logs, which means a crash on the live site
 * arrives here as a bare digest number on an error screen. Twice that
 * has cost real debugging time. `onRequestError` is Next's server-side
 * hook that still holds the REAL error, so every server error now also
 * writes one row to `runtime_errors`, where it can be read back over a
 * plain database connection and joined to the digest the user saw.
 *
 * Design constraints, all deliberate:
 *  - Fire-and-forget and swallow-everything: the recorder must never
 *    make a failing request fail harder, and must never throw during a
 *    crash that is already being handled.
 *  - Raw `postgres` driver, not the app's drizzle client: the module
 *    graph here must stay tiny and must not touch anything that could
 *    itself be the crashing code.
 *  - No PII: no user id, no query string, no headers, no body. Path,
 *    method, digest, message, stack. The stack is our own code.
 *  - Console.error too, so the Vercel log keeps being the primary
 *    record and this table is the readable copy.
 */

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routeType: string },
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    err && typeof err === "object" && "digest" in err
      ? String((err as { digest?: unknown }).digest ?? "")
      : null;

  // Redirects and not-founds flow through this hook too; they are
  // control flow, not errors, and recording them would bury the signal.
  if (digest?.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND") {
    return;
  }

  // eslint-disable-next-line no-console
  console.error(
    `[onRequestError] ${request.method} ${request.path} (${context.routeType}) digest=${digest ?? "-"}: ${message}`,
  );

  try {
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, {
      max: 1,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : "require",
      connect_timeout: 5,
    });
    const stack =
      err instanceof Error && err.stack ? err.stack.slice(0, 4000) : null;
    // Strip any query string defensively; tokens live in query strings.
    const path = request.path.split("?")[0] ?? request.path;
    await sql`
      INSERT INTO runtime_errors (id, digest, message, stack, path, method, kind)
      VALUES (
        ${`err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
        ${digest},
        ${message.slice(0, 2000)},
        ${stack},
        ${path.slice(0, 300)},
        ${request.method},
        ${context.routeType ?? context.routerKind ?? null}
      )
    `;
    await sql.end({ timeout: 2 });
  } catch {
    // The recorder never makes things worse.
  }
}
