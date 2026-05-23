"use client";

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { CheckCheck, Inbox } from "lucide-react";
import { markAllRead, markRead } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/query";

interface Props {
  initialItems: NotificationItem[];
  /** "View more / older" link target. Same page; the cursor is encoded as ?before=. */
  emptyState: { title: string; body: string; ctaHref: string; ctaLabel: string };
}

export function NotificationsList({ initialItems, emptyState }: Props) {
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();
  const unread = items.filter((i) => !i.readAt).length;

  function markOne(id: string) {
    setItems((cur) =>
      cur.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    startTransition(async () => {
      await markRead({ id });
    });
  }

  function markAll() {
    const now = new Date().toISOString();
    setItems((cur) => cur.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    startTransition(async () => {
      await markAllRead();
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-10 text-center">
        <Inbox
          className="mx-auto size-8 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
        <p className="mt-3 font-display text-lg">{emptyState.title}</p>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
          {emptyState.body}
        </p>
        <Link
          href={emptyState.ctaHref}
          className="mt-4 inline-flex items-center text-sm uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
        >
          {emptyState.ctaLabel} →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          {unread > 0 ? `${unread} unread · ${items.length} total` : `${items.length} total`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || unread === 0}
          onClick={markAll}
        >
          <CheckCheck className="size-4" aria-hidden="true" />
          Mark all read
        </Button>
      </div>
      <ul className="divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
        {items.map((n) => (
          <li
            key={n.id}
            className={
              "px-5 py-4 " +
              (n.readAt ? "" : "bg-[color:var(--color-brand-tint)]/30")
            }
          >
            <div className="flex items-start gap-3">
              {!n.readAt && (
                <span
                  aria-hidden="true"
                  className="mt-2 inline-block size-2 shrink-0 rounded-full bg-[color:var(--color-brand)]"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-base">{n.title}</span>
                  <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                {n.body && (
                  <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                    {n.body}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {n.link && (
                    <a
                      href={n.link}
                      onClick={() => {
                        if (!n.readAt) markOne(n.id);
                      }}
                      className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline"
                    >
                      Open →
                    </a>
                  )}
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => markOne(n.id)}
                      disabled={pending}
                      className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                    >
                      Mark read
                    </button>
                  )}
                  <code className="ml-auto rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5 text-[0.6rem] text-[color:var(--color-ink-soft)]">
                    {n.kind}
                  </code>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
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
