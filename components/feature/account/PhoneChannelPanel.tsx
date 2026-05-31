"use client";

/**
 * Phase 11.4.4  seeker-side phone / SMS / WhatsApp channel panel.
 *
 * Three render paths:
 *
 *   1. Both admin platform flags OFF
 *      Renders a "Coming soon" dormant card. The seeker can see the
 *      feature is planned but cannot opt in yet. Zero spend possible.
 *
 *   2. At least one admin platform flag ON, no verified phone
 *      Renders the verification flow: phone entry -> 6-digit code
 *      sent -> code entry -> verified. SMS even for the verification
 *      code goes through the same `sendSms` transport, which means
 *      the code SMS itself is gated by `SMS_PROVIDER` env. Without
 *      a real provider, the code prints to console (dev mode).
 *
 *   3. Verified phone present
 *      Renders the per-channel SMS / WhatsApp toggles + a "Remove
 *      this phone" control. Toggles flip seeker preference; admin
 *      allowlist controls actual dispatch (so even with toggle on,
 *      no SMS sends until admin adds the seeker to the allowlist).
 *
 * Mobile-first throughout.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import {
  requestPhoneVerificationCode,
  confirmPhoneVerification,
  clearPhoneVerification,
  setMessagingChannel,
} from "@/lib/messaging/phone";
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Phone,
  ShieldAlert,
} from "lucide-react";

interface Props {
  hasPhone: boolean;
  phoneVerifiedAt: string | null;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  /** Admin-controlled platform flags. When both OFF, the panel is
   *  dormant; opt-in surfaces are hidden. */
  platformSmsEnabled: boolean;
  platformWhatsappEnabled: boolean;
}

export function PhoneChannelPanel({
  hasPhone,
  phoneVerifiedAt,
  smsEnabled,
  whatsappEnabled,
  platformSmsEnabled,
  platformWhatsappEnabled,
}: Props) {
  const router = useRouter();
  const verified = hasPhone && !!phoneVerifiedAt;
  const platformAnyOn = platformSmsEnabled || platformWhatsappEnabled;

  // ── Dormant: both admin flags off ──────────────────────────────────
  if (!platformAnyOn) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-ink-soft)]"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-display text-base text-[color:var(--color-ink)]">
              SMS &amp; WhatsApp  coming soon
            </h3>
            <p className="mt-1 max-w-prose text-sm text-[color:var(--color-ink-soft)]">
              We&rsquo;re preparing an opt-in channel for critical
              events  vacancy invites + contact reveal  to reach
              you off-platform on SMS or WhatsApp. The infrastructure
              is in place; an admin will switch it on once the cost
              guardrails are signed off. No personal phone-number data
              is collected until then.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!verified ? (
        <VerificationFlow router={router} />
      ) : (
        <ManageFlow
          phoneVerifiedAt={phoneVerifiedAt}
          smsEnabled={smsEnabled}
          whatsappEnabled={whatsappEnabled}
          platformSmsEnabled={platformSmsEnabled}
          platformWhatsappEnabled={platformWhatsappEnabled}
          router={router}
        />
      )}
    </>
  );
}

interface Router {
  refresh: () => void;
}

function VerificationFlow({ router }: { router: Router }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSend() {
    setError(null);
    startTransition(async () => {
      const res = await requestPhoneVerificationCode(phone);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setStage("code");
    });
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmPhoneVerification(code);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
      <header className="flex items-start gap-3">
        <Phone
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <div>
          <h3 className="font-display text-base text-[color:var(--color-ink)]">
            Verify your phone for SMS / WhatsApp
          </h3>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            E.164 format (e.g. <code>+27821234567</code>). We send a
            6-digit code by SMS; enter it below. The number is stored
            encrypted; you can remove it any time.
          </p>
        </div>
      </header>

      {stage === "phone" ? (
        <div className="space-y-3">
          <TextField
            id="phone-e164"
            label="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+27821234567"
            type="tel"
            disabled={pending}
            autoComplete="tel"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSend}
              disabled={pending || phone.trim().length === 0}
            >
              {pending ? "Sending" : "Send code"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <TextField
            id="phone-code"
            label="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            disabled={pending}
            maxLength={6}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setStage("phone");
                setCode("");
              }}
              disabled={pending}
            >
              Change number
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onConfirm}
              disabled={pending || code.trim().length !== 6}
            >
              {pending ? "Confirming" : "Confirm"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function ManageFlow({
  phoneVerifiedAt,
  smsEnabled,
  whatsappEnabled,
  platformSmsEnabled,
  platformWhatsappEnabled,
  router,
}: {
  phoneVerifiedAt: string | null;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  platformSmsEnabled: boolean;
  platformWhatsappEnabled: boolean;
  router: Router;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(channel: "sms" | "whatsapp", next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setMessagingChannel(channel, next);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await clearPhoneVerification();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-display text-base text-[color:var(--color-ink)]">
              Phone verified
            </h3>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              {phoneVerifiedAt
                ? `Verified ${new Date(phoneVerifiedAt).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })}.`
                : "Verified."}{" "}
              Your number is stored encrypted; only the dispatch layer
              can decrypt + send.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={remove}
          disabled={pending}
        >
          Remove phone
        </Button>
      </header>

      <ChannelToggle
        label="SMS"
        icon={<MessageCircle className="size-4" aria-hidden="true" />}
        enabled={smsEnabled}
        platformEnabled={platformSmsEnabled}
        onToggle={(n) => toggle("sms", n)}
        disabled={pending}
      />

      <ChannelToggle
        label="WhatsApp"
        icon={<MessageCircle className="size-4" aria-hidden="true" />}
        enabled={whatsappEnabled}
        platformEnabled={platformWhatsappEnabled}
        onToggle={(n) => toggle("whatsapp", n)}
        disabled={pending}
      />

      <p className="border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs italic text-[color:var(--color-ink-soft)]">
        Even with these toggles ON, Sebenza waits for an admin to add
        you to the messaging allowlist before sending real messages.
        Currently scoped to critical events only (vacancy invites,
        contact-reveal requests).
      </p>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function ChannelToggle({
  label,
  icon,
  enabled,
  platformEnabled,
  onToggle,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  platformEnabled: boolean;
  onToggle: (next: boolean) => void;
  disabled: boolean;
}) {
  if (!platformEnabled) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-3 text-sm text-[color:var(--color-ink-soft)]">
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="text-[0.62rem] uppercase tracking-[0.22em]">
          Not available yet
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
      <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
        {icon}
        {label}
      </span>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        disabled={disabled}
        role="switch"
        aria-checked={enabled}
        className={
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors " +
          (enabled
            ? "bg-[color:var(--color-ink)]"
            : "bg-[color:var(--color-hairline)]")
        }
      >
        <span
          className={
            "inline-block size-5 transform rounded-full bg-[color:var(--color-paper)] shadow transition-transform " +
            (enabled ? "translate-x-5" : "translate-x-0.5")
          }
        />
        <span className="sr-only">
          {enabled ? `${label} on` : `${label} off`}
        </span>
      </button>
    </div>
  );
}
