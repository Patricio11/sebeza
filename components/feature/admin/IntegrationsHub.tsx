"use client";

/**
 * Phase 25  the channel-management island: configure (creds encrypted server-
 * side, never echoed back), enable/disable per channel, plus the consent-gated
 * bulk-announcement composer. Secrets fields are always blank on render
 * configured state shows as a badge, not the value.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  MessageSquare,
  MessageCircle,
  Mail,
  Megaphone,
  Loader2,
  Power,
} from "lucide-react";
import {
  saveIntegration,
  setIntegrationEnabled,
} from "@/lib/admin/integrations";
import { sendAnnouncement } from "@/lib/admin/announcements";
import type { IntegrationChannel, IntegrationSource } from "@/lib/integrations/resolve";

export interface ChannelView {
  channel: IntegrationChannel;
  configured: boolean;
  enabled: boolean;
  source: IntegrationSource;
  config: Record<string, string>;
  updatedAt: string | null;
}

const CHANNEL_META: Record<
  IntegrationChannel,
  { title: string; icon: React.ReactNode; blurb: string }
> = {
  sms: {
    title: "SMS",
    icon: <MessageSquare className="size-4" aria-hidden="true" />,
    blurb:
      "Critical notifications + announcements. Twilio (working path), SNS, or console (dev). Sends still require the platform flag, per-user consent, verified phone + allowlist.",
  },
  whatsapp: {
    title: "WhatsApp",
    icon: <MessageCircle className="size-4" aria-hidden="true" />,
    blurb:
      "Critical notifications over WhatsApp Business (Twilio path). Same multi-gate posture as SMS.",
  },
  email: {
    title: "Email (SMTP)",
    icon: <Mail className="size-4" aria-hidden="true" />,
    blurb:
      "Transactional email. When configured + enabled here, these credentials replace the SMTP_* env vars.",
  },
};

export function IntegrationsHub({
  channels,
  announcementRecipients,
  smsFlagOn,
  whatsappFlagOn,
}: {
  channels: ChannelView[];
  announcementRecipients: number;
  smsFlagOn: boolean;
  whatsappFlagOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section aria-label="Channels" className="grid gap-4 lg:grid-cols-3">
        {channels.map((c) => (
          <ChannelCard
            key={c.channel}
            view={c}
            flagNote={
              c.channel === "sms"
                ? `Platform flag: ${smsFlagOn ? "ON" : "OFF"} (/admin/settings)`
                : c.channel === "whatsapp"
                  ? `Platform flag: ${whatsappFlagOn ? "ON" : "OFF"} (/admin/settings)`
                  : null
            }
            pending={pending}
            run={run}
          />
        ))}
      </section>

      <AnnouncementComposer
        recipients={announcementRecipients}
        pending={pending}
        run={run}
      />
    </div>
  );
}

function ChannelCard({
  view,
  flagNote,
  pending,
  run,
}: {
  view: ChannelView;
  flagNote: string | null;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const meta = CHANNEL_META[view.channel];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const field =
    "h-9 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-2.5 text-sm outline-none focus:border-[color:var(--color-brand)]";

  function save() {
    setError(null);
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    if (view.channel === "sms") {
      config.provider = form.provider ?? "console";
      config.fromNumber = form.fromNumber ?? "";
      config.awsRegion = form.awsRegion ?? "";
      secrets.twilioSid = form.twilioSid ?? "";
      secrets.twilioToken = form.twilioToken ?? "";
      secrets.awsAccessKeyId = form.awsAccessKeyId ?? "";
      secrets.awsSecretAccessKey = form.awsSecretAccessKey ?? "";
    } else if (view.channel === "whatsapp") {
      config.provider = form.provider ?? "console";
      config.fromNumber = form.fromNumber ?? "";
      secrets.twilioSid = form.twilioSid ?? "";
      secrets.twilioToken = form.twilioToken ?? "";
    } else {
      config.host = form.host ?? "";
      config.port = form.port ?? "587";
      config.from = form.from ?? "";
      config.secure = form.secure ?? "false";
      secrets.user = form.user ?? "";
      secrets.pass = form.pass ?? "";
    }
    run(async () => {
      const r = await saveIntegration(view.channel, config, secrets);
      if (r.ok) {
        setOpen(false);
        setForm({});
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-base">
          {meta.icon}
          {meta.title}
        </div>
        <span
          className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em] ${
            view.configured && view.enabled
              ? "border border-[color:var(--color-brand)] text-[color:var(--color-brand-strong)]"
              : "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          {view.configured
            ? view.enabled
              ? "Admin · live"
              : "Admin · disabled"
            : view.source === "env"
              ? "Env fallback"
              : "Not configured"}
        </span>
      </div>
      <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">{meta.blurb}</p>
      {flagNote && (
        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{flagNote}</p>
      )}
      {view.configured && view.updatedAt && (
        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
          Credentials stored (encrypted) · updated{" "}
          {new Date(view.updatedAt).toLocaleDateString("en-ZA")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 text-xs hover:border-[color:var(--color-ink)]"
        >
          {view.configured ? "Reconfigure" : "Configure"}
        </button>
        {view.configured && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => setIntegrationEnabled(view.channel, !view.enabled))
            }
            className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 text-xs hover:border-[color:var(--color-ink)] disabled:opacity-50"
          >
            <Power className="size-3.5" aria-hidden="true" />
            {view.enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-dashed border-[color:var(--color-hairline)] pt-3">
          {view.channel !== "email" && (
            <>
              <select
                aria-label={`${meta.title} provider`}
                value={form.provider ?? "console"}
                onChange={(e) => set("provider", e.target.value)}
                className={field}
              >
                <option value="console">console (dev  logs only)</option>
                <option value="twilio">twilio</option>
                {view.channel === "sms" && <option value="sns">sns (AWS)</option>}
              </select>
              <input className={field} placeholder="From number (+27…)" value={form.fromNumber ?? ""} onChange={(e) => set("fromNumber", e.target.value)} />
              <input className={field} placeholder="Twilio Account SID" value={form.twilioSid ?? ""} onChange={(e) => set("twilioSid", e.target.value)} />
              <input className={field} type="password" placeholder="Twilio Auth Token" value={form.twilioToken ?? ""} onChange={(e) => set("twilioToken", e.target.value)} />
              {view.channel === "sms" && (
                <>
                  <input className={field} placeholder="AWS region (sns only)" value={form.awsRegion ?? ""} onChange={(e) => set("awsRegion", e.target.value)} />
                  <input className={field} placeholder="AWS access key id (sns only)" value={form.awsAccessKeyId ?? ""} onChange={(e) => set("awsAccessKeyId", e.target.value)} />
                  <input className={field} type="password" placeholder="AWS secret (sns only)" value={form.awsSecretAccessKey ?? ""} onChange={(e) => set("awsSecretAccessKey", e.target.value)} />
                </>
              )}
            </>
          )}
          {view.channel === "email" && (
            <>
              <input className={field} placeholder="SMTP host" value={form.host ?? ""} onChange={(e) => set("host", e.target.value)} />
              <input className={field} placeholder="Port (587)" value={form.port ?? ""} onChange={(e) => set("port", e.target.value)} />
              <input className={field} placeholder="From (Sebenza <noreply@…>)" value={form.from ?? ""} onChange={(e) => set("from", e.target.value)} />
              <input className={field} placeholder="SMTP user" value={form.user ?? ""} onChange={(e) => set("user", e.target.value)} />
              <input className={field} type="password" placeholder="SMTP password" value={form.pass ?? ""} onChange={(e) => set("pass", e.target.value)} />
            </>
          )}
          {error && (
            <p role="alert" className="text-xs text-[color:var(--color-danger)]">{error}</p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-3 text-xs text-[color:var(--color-paper)] disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            Save (encrypted)  enable separately
          </button>
        </div>
      )}
    </div>
  );
}

function AnnouncementComposer({
  recipients,
  pending,
  run,
}: {
  recipients: number;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      aria-label="Bulk announcement"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex items-center gap-2 font-display text-lg">
        <Megaphone className="size-5 text-[color:var(--color-brand)]" aria-hidden="true" />
        Bulk announcement (SMS)
      </div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
        POPIA: goes ONLY to users who opted into the{" "}
        <em>Platform announcements</em> consent AND have a verified phone.
        Currently eligible:{" "}
        <strong className="font-display tabular text-[color:var(--color-ink)]">
          {recipients}
        </strong>
        . Hard cap 500 per send; every send is audit-logged (count only).
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Announcement text (10–300 characters, ~2 SMS segments)"
        className="mt-3 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          I confirm this goes to {recipients} consenting user
          {recipients === 1 ? "" : "s"} and incurs SMS cost.
        </label>
        <button
          type="button"
          disabled={pending || !confirm || message.trim().length < 10 || recipients === 0}
          onClick={() => {
            setError(null);
            setResult(null);
            run(async () => {
              const r = await sendAnnouncement(message);
              if (r.ok) {
                setResult(`Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"} (${r.skipped} skipped).`);
                setMessage("");
                setConfirm(false);
              } else {
                setError(r.error);
              }
            });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send announcement
        </button>
      </div>
      {result && (
        <p role="status" className="mt-2 text-xs text-[color:var(--color-brand-strong)]">{result}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">{error}</p>
      )}
    </section>
  );
}
