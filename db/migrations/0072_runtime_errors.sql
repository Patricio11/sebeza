-- Black-box recorder for production server errors.
--
-- Next.js strips error messages from the browser in production and
-- keeps them only in the platform's function logs. Twice now that has
-- meant debugging a Vercel-only crash from a bare digest number. This
-- table gives the platform its own record: `onRequestError` in
-- instrumentation.ts writes one row per server error, and an operator
-- (or Claude, over a read-only connection) can join a digest from an
-- error screen to a real message and stack.
--
-- POPIA: deliberately stores NO user identity, no query strings, no
-- headers, no bodies. Path, method, digest, message, stack. The stack
-- is our own code; the path is already in the platform's access logs.

CREATE TABLE IF NOT EXISTS runtime_errors (
  id         text PRIMARY KEY,
  at         timestamp NOT NULL DEFAULT now(),
  digest     text,
  message    text NOT NULL,
  stack      text,
  path       text NOT NULL,
  method     text NOT NULL,
  -- 'render' | 'action' | 'route' | 'middleware' etc, from Next's context.
  kind       text
);

CREATE INDEX IF NOT EXISTS runtime_errors_at_idx ON runtime_errors (at);
CREATE INDEX IF NOT EXISTS runtime_errors_digest_idx ON runtime_errors (digest);
