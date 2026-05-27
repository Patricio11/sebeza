"use client";

/**
 * Phase 9.17 follow-up  shared form-draft persistence hook.
 *
 * Persists an in-flight form draft to `sessionStorage` so that
 * in-app navigations (notably the locale switcher, which next-intl
 * implements by swapping the URL  e.g. `/en/sign-up` → `/zu/sign-up`
 *  and remounting the page tree) don't wipe whatever the user had
 * typed.
 *
 * Design choices  consistent across every form that uses this hook:
 *
 *   1. **`sessionStorage`, not `localStorage`.** Tab-scoped, cleared
 *      when the tab/window closes. No long-lived half-completed
 *      drafts on shared computers.
 *   2. **Caller controls what gets persisted.** The hook serialises
 *      whatever `state` you hand it. Passwords / files / blobs / any
 *      sensitive field should be omitted by the caller BEFORE
 *      handing state in. The hook itself trusts but doesn't filter.
 *   3. **Restoration runs in a useEffect, not the initial useState.**
 *      Keeps the SSR markup in sync with the first client render
 *      no React hydration mismatch warning. The component briefly
 *      renders with the bare initial state, then the draft layer
 *      applies; in practice this is invisible because client-side
 *      hydration completes before paint.
 *   4. **Silent failure on disabled storage.** Private browsing modes
 *      + enterprise lockdowns + quota errors all throw on
 *      `sessionStorage.setItem`. We swallow the error  the form
 *      still works, the user just doesn't get draft restoration.
 *   5. **`clear()` returned to the caller.** Successful submit
 *      should call `clear()` so the next visitor on the same tab
 *      doesn't inherit half-typed data.
 *
 * Usage:
 *
 *   const { clear } = useSessionDraft<MyPersistable>("my-form-key", {
 *     state: { ...persistableSlice },
 *     onRestore: (draft) => setState((s) => ({ ...s, ...draft })),
 *   });
 *
 *   // On submit success:
 *   clear();
 */

import { useEffect, useRef, useState } from "react";

export interface UseSessionDraftOptions<TPersistable> {
  /**
   * The slice of state you want persisted. ALL sensitive fields
   * (passwords, file blobs, secrets) must be excluded BEFORE handing
   * the slice in. The hook serialises this object verbatim.
   */
  state: TPersistable;
  /**
   * Called once on mount if a draft exists in storage. The argument
   * is the partial deserialised draft  apply it to your form state
   * however makes sense (merging, re-overlaying authoritative
   * fields, validating shape, etc.).
   */
  onRestore: (draft: Partial<TPersistable>) => void;
  /**
   * Skip both restoration AND persistence. Default `true`. Pass
   * `false` when the form is in a context that already has
   * authoritative pre-fills (e.g. an invitation token) and the user
   * shouldn't see a stale public draft mixed in.
   */
  enabled?: boolean;
}

export interface UseSessionDraftReturn {
  /** Remove the draft from sessionStorage. Call after successful submit. */
  clear: () => void;
}

export function useSessionDraft<TPersistable>(
  key: string,
  options: UseSessionDraftOptions<TPersistable>,
): UseSessionDraftReturn {
  const { state, onRestore, enabled = true } = options;
  const [hydrated, setHydrated] = useState(false);
  // Capture the initial onRestore + enabled values via useRef. We
  // never re-assign during render  the restore effect fires once
  // and only cares about the values at mount time. This satisfies
  // the react-hooks/refs lint rule (no ref-writes outside of effects /
  // event handlers) while preserving the correct semantics: a stable
  // restore callback + a mount-time restoration decision.
  const onRestoreRef = useRef(onRestore);
  const enabledAtMountRef = useRef(enabled);

  // Restore once on mount.
  useEffect(() => {
    if (hydrated) return;
    if (!enabledAtMountRef.current) {
      setHydrated(true);
      return;
    }
    try {
      const raw =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(key)
          : null;
      if (raw) {
        const saved = JSON.parse(raw) as Partial<TPersistable>;
        onRestoreRef.current(saved);
      }
    } catch {
      // ignore: storage disabled, JSON corrupt, etc.
    }
    setHydrated(true);
  }, [hydrated, key]);

  // Persist on every state change once hydrated. `enabled` is in the
  // dep array so a runtime toggle (e.g. caller flips to false to
  // stop persisting mid-flow) takes effect immediately.
  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore: quota / disabled storage
    }
  }, [hydrated, key, state, enabled]);

  function clear() {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }

  return { clear };
}
