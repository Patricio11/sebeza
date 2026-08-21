"use client";

/**
 * Phase 35  the web-push opt-in.
 *
 * Deliberately NOT auto-prompting. The browser's permission dialog is
 * one-shot per origin: a person who dismisses it can effectively never
 * be asked again, and every major browser now penalises sites that fire
 * it on page load. So nothing happens until someone presses the button,
 * and the button explains what it is for before it appears.
 *
 * Renders nothing at all when push is unconfigured, flagged off, or
 * unsupported by the browser, rather than showing a dead control.
 *
 * iOS note: Safari only allows push once the site has been added to the
 * home screen. We detect that case and say so plainly instead of
 * letting the request fail with no explanation.
 */

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/actions";

/** The VAPID public key travels as base64url and must reach
 *  `pushManager.subscribe` as raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  // Backed by an explicit ArrayBuffer: `applicationServerKey` wants a
  // BufferSource, and a plain `new Uint8Array(n)` widens to
  // ArrayBufferLike, which includes SharedArrayBuffer and is rejected.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type Phase =
  | "loading"
  | "unavailable"
  | "needs-install" // iOS, not added to the home screen
  | "off"
  | "on"
  | "blocked"; // permission denied at the browser level

export function PushOptIn() {
  const t = useTranslations("pushOptIn");
  const [phase, setPhase] = useState<Phase>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [devices, setDevices] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      const status = await getPushStatus();
      if (cancelled) return;
      if (!status.available) {
        setPhase("unavailable");
        return;
      }
      setPublicKey(status.publicKey);
      setDevices(status.devices);

      if (!supported) {
        // On iOS the APIs only exist inside an installed PWA, so an
        // iPhone that has not added Sebenza to the home screen lands
        // here. Say that, rather than "not supported", which reads as
        // "your phone is too old".
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        setPhase(isIos ? "needs-install" : "unavailable");
        return;
      }

      if (Notification.permission === "denied") {
        setPhase("blocked");
        return;
      }
      // Trust the browser, not our own table: a subscription can be
      // revoked from browser settings without telling the server.
      const reg = await navigator.serviceWorker.getRegistration();
      const existing = await reg?.pushManager.getSubscription();
      setPhase(existing ? "on" : "off");
    })().catch(() => setPhase("unavailable"));
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPhase(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg =
          (await navigator.serviceWorker.getRegistration()) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey ?? ""),
        });
        const json = sub.toJSON() as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };
        const res = await subscribeToPush({
          endpoint: json.endpoint ?? "",
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setDevices((n) => n + 1);
        setPhase("on");
      } catch {
        setError(t("errRegister"));
      }
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        const endpoint = sub?.endpoint;
        // Unsubscribe in the browser FIRST. If the server call fails
        // afterwards the worst case is a stale row that gets pruned on
        // its next failed delivery; the reverse order could leave the
        // device still receiving pushes it asked to stop.
        await sub?.unsubscribe();
        await unsubscribeFromPush(endpoint);
        setDevices((n) => Math.max(0, n - 1));
        setPhase("off");
      } catch {
        setError(t("errDisable"));
      }
    });
  }

  if (phase === "loading" || phase === "unavailable") return null;

  return (
    <section
      aria-labelledby="push-optin-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[color:var(--color-brand-strong)]">
          {phase === "on" ? (
            <BellRing className="size-5" aria-hidden="true" />
          ) : phase === "blocked" ? (
            <BellOff className="size-5" aria-hidden="true" />
          ) : (
            <Bell className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="push-optin-h" className="font-display text-base">
            {t("title")}
          </h2>

          {phase === "off" && (
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("offBody")}
            </p>
          )}

          {phase === "on" && (
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("onBody", { others: Math.max(0, devices - 1) })}
            </p>
          )}

          {phase === "blocked" && (
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("blockedBody")}
            </p>
          )}

          {phase === "needs-install" && (
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("installBody")}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-2 text-sm text-[color:var(--color-danger)]"
            >
              {error}
            </p>
          )}

          {(phase === "off" || phase === "on") && (
            <div className="mt-3">
              <Button
                type="button"
                variant={phase === "on" ? "secondary" : "primary"}
                onClick={phase === "on" ? disable : enable}
                disabled={pending}
              >
                {pending && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                )}
                {phase === "on" ? t("disableCta") : t("enableCta")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
