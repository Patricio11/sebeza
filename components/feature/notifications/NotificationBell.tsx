"use client";

/**
 * Phase 7 (Task 7.6)  Bell icon + unread badge + dropdown panel.
 *
 * Every notification originates in a specific Server Action (reveal,
 * download, approval, etc.) which calls `revalidatePath` on the
 * relevant surfaces. The bell's initial state is server-fetched on
 * every render, so simply navigating around the app refreshes it
 * naturally  no polling or WebSocket required. The local
 * `markRead`/`markAllRead` Server Actions update state optimistically
 * and then revalidate.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { markAllRead, markRead } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/query";

interface Props {
  /** Path of the role-scoped "View all" page. */
  fullPageHref: string;
  initialUnreadCount: number;
  initialItems: NotificationItem[];
  /** Visual variant  desktop masthead vs mobile top strip. */
  variant?: "default" | "compact";
}

export function NotificationBell({
  fullPageHref,
  initialUnreadCount,
  initialItems,
  variant = "default",
}: Props) {
  const [unread, setUnread] = useState(initialUnreadCount);
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        panelRef.current?.contains(t) ||
        buttonRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleMarkOne(id: string) {
    setItems((cur) =>
      cur.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((c) => Math.max(0, c - 1));
    startTransition(async () => {
      await markRead({ id });
    });
  }

  function handleMarkAll() {
    const now = new Date().toISOString();
    setItems((cur) => cur.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnread(0);
    startTransition(async () => {
      await markAllRead();
    });
  }

  const badge = unread > 9 ? "9+" : String(unread);
  const sizeClasses =
    variant === "compact" ? "size-9" : "size-10";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Notifications${unread > 0 ? `  ${unread} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex ${sizeClasses} items-center justify-center rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]`}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1 py-0.5 text-[0.62rem] font-medium leading-none text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Recent notifications"
          className="absolute right-0 z-40 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-lg"
        >
          <header className="flex items-center justify-between border-b border-[color:var(--color-hairline)] px-4 py-3">
            <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Notifications
            </span>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending || unread === 0}
              className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
          </header>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[color:var(--color-ink-soft)]">
              You're all caught up.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.slice(0, 10).map((n) => (
                <li
                  key={n.id}
                  className="border-b border-[color:var(--color-hairline)] last:border-b-0"
                >
                  <a
                    href={n.link ?? fullPageHref}
                    onClick={() => {
                      if (!n.readAt) handleMarkOne(n.id);
                    }}
                    className={
                      "block px-4 py-3 text-sm hover:bg-[color:var(--color-surface-sunk)] " +
                      (n.readAt
                        ? "text-[color:var(--color-ink-soft)]"
                        : "text-[color:var(--color-ink)]")
                    }
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-[color:var(--color-brand)]"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="mt-0.5 text-xs text-[color:var(--color-ink-soft)] line-clamp-2">
                            {n.body}
                          </div>
                        )}
                        <div className="mt-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                          {relativeTime(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <footer className="border-t border-[color:var(--color-hairline)] px-4 py-2.5 text-center">
            <a
              href={fullPageHref}
              className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
            >
              View all →
            </a>
          </footer>
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
