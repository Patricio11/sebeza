/**
 * Stale-tab-after-deploy recovery.
 *
 * Every deploy renames the Server Action ids. A tab that was open before
 * the deploy keeps calling the old ids and Next rejects each call with
 * "Server Action ... was not found on the server" (docs:
 * failed-to-find-server-action). On a live product that ships daily this
 * is not rare: the founder's own tab lost a skills save and crashed on
 * Sign out. Nothing is wrong with the user's data; the tab just needs
 * the new bundle. So: recognise the error, reload once (session drafts
 * survive a reload), and never loop.
 */

const STALE_PATTERNS = [
  /failed to find server action/i,
  /server action .* was not found on the server/i,
  /unrecognizedactionerror/i,
];

export function isStaleServerActionError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return STALE_PATTERNS.some((p) => p.test(text));
}

const GUARD_KEY = "sebenza:reloaded-for-new-version";
const GUARD_WINDOW_MS = 60_000;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Decide whether a reload is allowed now. True at most once per
 * GUARD_WINDOW_MS per tab, so a genuinely broken deploy cannot spin the
 * browser. Pure apart from the storage handed in (testable).
 */
export function shouldReloadForNewVersion(
  storage: StorageLike | null,
  now: number,
): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(GUARD_KEY);
    if (raw !== null) {
      const last = Number(raw);
      if (Number.isFinite(last) && now - last < GUARD_WINDOW_MS) return false;
    }
    storage.setItem(GUARD_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

/** Reload the tab once for a new version. Returns false when the guard refused. */
export function reloadOnceForNewVersion(): boolean {
  if (typeof window === "undefined") return false;
  let storage: StorageLike | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  if (!shouldReloadForNewVersion(storage, Date.now())) return false;
  window.location.reload();
  return true;
}
