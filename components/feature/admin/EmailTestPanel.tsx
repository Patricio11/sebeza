"use client";

/**
 * Diagnostic test-email panel on /admin/settings.
 *
 * Fires `sendTestEmail()` against a typed-in recipient + reports the
 * outcome inline:
 *
 *   - ok + transport = "smtp"     : email actually left for the SMTP
 *                                     provider. Provider message id
 *                                     shown so admins can find the
 *                                     record in Resend / Sendgrid /
 *                                     etc.
 *   - ok + transport = "console"  : EMAIL_TRANSPORT was not set to
 *                                     "smtp"  the send "succeeded" by
 *                                     logging to stdout, not by
 *                                     reaching any provider. The
 *                                     panel calls this out loudly so
 *                                     an operator immediately knows
 *                                     to fix the env var.
 *   - error                       : message from the transport
 *                                     (typically the underlying SMTP
 *                                     reject reason or a missing-cred
 *                                     guard from sendEmail()).
 */

import { useState, useTransition } from "react";
import { Send, AlertTriangle, CheckCircle2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { sendTestEmail, type TestEmailResult } from "@/lib/admin/email-debug";

interface Props {
  /** Pre-fills the To field with the signed-in admin's own email so a
   *  one-click test always lands somewhere they can read. */
  defaultRecipient: string;
}

export function EmailTestPanel({ defaultRecipient }: Props) {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TestEmailResult | null>(null);

  function onSend() {
    setResult(null);
    startTransition(async () => {
      const r = await sendTestEmail({ to: recipient.trim() });
      setResult(r);
    });
  }

  const consoleFallback = result?.ok && result.transport === "console";

  return (
    <section className="md:col-span-2">
      <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
        Email pipeline test
      </h2>
      <p className="mb-4 text-sm text-[color:var(--color-ink-soft)]">
        Fires a one-off email through the same{" "}
        <code>sendEmail()</code> pipeline every other code path uses.
        Use this to confirm SMTP credentials, domain verification, and
        the <code>EMAIL_TRANSPORT</code> switch are all lined up in
        production before a real user is affected. Every send is
        audit-logged.
      </p>

      <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <TextField
              id="test-email-recipient"
              label="Recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onSend}
            disabled={pending || recipient.trim().length === 0}
          >
            <Send className="size-4" aria-hidden="true" />
            {pending ? "Sending…" : "Send test"}
          </Button>
        </div>
        <p className="mt-2 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          Defaults to your own admin email. Override if you want to test
          deliverability to a specific inbox.
        </p>
      </div>

      {result && (
        <div
          role="status"
          className={
            "mt-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm " +
            (!result.ok
              ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
              : consoleFallback
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-ink)]"
                : "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-ink)]")
          }
        >
          {!result.ok && (
            <>
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Send failed
              </div>
              <p className="mt-1 text-xs">{result.message}</p>
              <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
                Check the server logs for the underlying SMTP error
                ({" "}
                <code>console.error</code> on the next deploy log line).
                Most common causes: SMTP credentials wrong / missing,
                Resend domain not yet verified, or
                <code>SMTP_FROM</code> uses a domain that isn&rsquo;t
                verified with the provider.
              </p>
            </>
          )}
          {result.ok && consoleFallback && (
            <>
              <div className="flex items-center gap-2 font-medium">
                <Terminal className="size-4" aria-hidden="true" />
                Transport fell back to console
              </div>
              <p className="mt-1 text-xs">
                The send &ldquo;succeeded&rdquo; by logging to the
                server terminal instead of reaching any SMTP provider.
                This means <code>EMAIL_TRANSPORT</code> is not set to{" "}
                <code>smtp</code> on this deploy. Set the env var and
                redeploy  no email actually left the server.
              </p>
            </>
          )}
          {result.ok && !consoleFallback && (
            <>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Email accepted by SMTP provider
              </div>
              <p className="mt-1 text-xs">
                Transport: <code>{result.transport}</code>
                {result.messageId && (
                  <>
                    {" · "}Provider message ID:{" "}
                    <code>{result.messageId}</code>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
                Look for this message in your provider dashboard
                (Resend &rarr; Emails / Logs). If it isn&rsquo;t there
                within a minute, your provider rejected the recipient
                domain or the send was throttled.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
