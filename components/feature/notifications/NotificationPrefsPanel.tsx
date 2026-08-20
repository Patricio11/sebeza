"use client";

/**
 * Phase 7 (C.6)  Notification preferences panel.
 *
 * One row per catalog kind, three columns: In-app · Email · Push.
 *
 * Two things deliberately absent: the raw catalog key (a database
 * identifier that means nothing to the person reading it) and any
 * mention of our internal phase numbering. A disabled channel says
 * "Soon", which is true and is all a user needs to know.
 * A column whose channel is not live is disabled with a pill rather
 * than hidden, so the shape of the panel does not change when a
 * channel is switched on.
 *
 * The seeker / employer / admin account pages pick which kinds to
 * show (some are admin-only, e.g. `moderation.reported`). The panel
 * itself stays role-agnostic  caller filters the catalog.
 */

import { useState, useTransition } from "react";
import { updateNotificationPref } from "@/lib/notifications/actions";
import {
  effectivePref,
  NOTIFICATION_CATALOG,
  type NotificationKind,
  type NotificationPref,
  type NotificationPrefMap,
} from "@/lib/notifications/catalog";

interface Props {
  /** The user's stored prefs JSON (raw  we resolve effective values inside). */
  initialPrefs: NotificationPrefMap | null;
  /** Catalog keys to render. Caller decides which kinds are relevant to the role. */
  kinds: NotificationKind[];
  /** Phase 8  whether the master email-channel flag is on. When off,
   *  the email column stays disabled behind a "Soon" pill. */
  emailChannelEnabled?: boolean;
  /** Phase 35  whether the master web-push flag is on. Note this is
   *  the PLATFORM switch only: a user still has to grant permission on
   *  each device (see PushOptIn), so a push toggle being on here means
   *  "send it to my phone IF my phone is registered". */
  pushChannelEnabled?: boolean;
}

export function NotificationPrefsPanel({
  initialPrefs,
  kinds,
  emailChannelEnabled = false,
  pushChannelEnabled = false,
}: Props) {
  return (
    <ul className="divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
      {kinds.map((kind) => (
        <PrefRow
          key={kind}
          kind={kind}
          initialEffective={effectivePref(initialPrefs, kind)}
          emailChannelEnabled={emailChannelEnabled}
          pushChannelEnabled={pushChannelEnabled}
        />
      ))}
    </ul>
  );
}

function PrefRow({
  kind,
  initialEffective,
  emailChannelEnabled,
  pushChannelEnabled,
}: {
  kind: NotificationKind;
  initialEffective: NotificationPref;
  emailChannelEnabled: boolean;
  pushChannelEnabled: boolean;
}) {
  const meta = NOTIFICATION_CATALOG[kind];
  const [pref, setPref] = useState<NotificationPref>(initialEffective);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleInApp(next: boolean) {
    setError(null);
    const previous = pref;
    setPref((p) => ({ ...p, inApp: next }));
    startTransition(async () => {
      const res = await updateNotificationPref({ kind, inApp: next });
      if (!res.ok) {
        setPref(previous);
        setError(res.message);
      }
    });
  }

  function toggleEmail(next: boolean) {
    setError(null);
    const previous = pref;
    setPref((p) => ({ ...p, email: next }));
    startTransition(async () => {
      const res = await updateNotificationPref({ kind, email: next });
      if (!res.ok) {
        setPref(previous);
        setError(res.message);
      }
    });
  }

  function togglePush(next: boolean) {
    setError(null);
    const previous = pref;
    setPref((p) => ({ ...p, push: next }));
    startTransition(async () => {
      const res = await updateNotificationPref({ kind, push: next });
      if (!res.ok) {
        setPref(previous);
        setError(res.message);
      }
    });
  }

  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
      <div>
        <div className="font-display text-base">{meta.label}</div>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          {meta.description}
        </p>
        {error && (
          <p className="mt-1 text-xs text-[color:var(--color-danger)]">{error}</p>
        )}
      </div>

      <Toggle
        label="In-app"
        on={pref.inApp}
        disabled={pending}
        onChange={toggleInApp}
      />

      <Toggle
        label="Email"
        on={emailChannelEnabled && pref.email}
        disabled={!emailChannelEnabled || pending}
        pill={emailChannelEnabled ? undefined : "Soon"}
        onChange={toggleEmail}
      />

      <Toggle
        label="Phone"
        on={pushChannelEnabled && pref.push}
        disabled={!pushChannelEnabled || pending}
        pill={pushChannelEnabled ? undefined : "Soon"}
        onChange={togglePush}
      />
    </li>
  );
}

function Toggle({
  label,
  on,
  disabled,
  pill,
  onChange,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  pill?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className={
          "text-[0.62rem] uppercase tracking-[0.18em] " +
          (disabled
            ? "text-[color:var(--color-ink-soft)]"
            : "text-[color:var(--color-ink)]")
        }
      >
        {label}
      </span>
      {pill && (
        <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          {pill}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label} notifications`}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={
          "h-6 w-11 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
          (on
            ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]"
            : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]")
        }
      >
        <span
          className={
            "block size-5 rounded-full bg-white transition-transform " +
            (on ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
