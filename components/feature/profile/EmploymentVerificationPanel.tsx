"use client";

/**
 * Phase 9.23  client island for the dashboard "Verify employment"
 * affordance. Three states:
 *
 *   none      no verification in flight  show the consent form
 *   pending   contact has been emailed; 14-day window  show
 *              "in flight" panel + withdraw button + the days remaining
 *   resolved  verified / declined / disputed / expired / superseded
 *              / withdrawn  show the outcome strip + "Request a new
 *              verification" CTA (when status allows)
 *
 * The consent checkbox text is structured per D0 + the contact name +
 * email inputs sit beneath it. Submit calls
 * `requestEmploymentVerification` which fires the one-shot email.
 *
 * Privacy posture: this island never receives the contact email back
 * from the server  it's only entered by the seeker, posted to the
 * action, encrypted on save, redacted on response. The UI only
 * displays the contact name + the binary outcome on resolved rows.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  requestEmploymentVerification,
  withdrawEmploymentVerification,
  type MyVerificationRow,
} from "@/lib/profile/employment-verification";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldOff,
} from "lucide-react";

interface Props {
  /** Seeker's most recent verification record, or null. */
  current: MyVerificationRow | null;
  /** Seeker's status. Verification is gated on 'employed' per D2. */
  status: string;
  /** Seeker's current employer id. Verification only if it matches the
   *  in-flight record's employerOrgId  changes auto-supersede via the
   *  Phase 9.22 hook. */
  currentEmployerOrgId: string | null;
  /** Seeker's current employer name  for display only. */
  currentEmployerName: string | null;
}

const eligibleStatus = (s: string) => s === "employed";

export function EmploymentVerificationPanel({
  current,
  status,
  currentEmployerOrgId,
  currentEmployerName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);

  function onSubmit() {
    setError(null);
    if (!currentEmployerOrgId) {
      setError(
        "Pick a current employer above first  verification needs an employer to verify against.",
      );
      return;
    }
    if (!consentAccepted) {
      setError("Tick the consent box to continue.");
      return;
    }
    startTransition(async () => {
      const res = await requestEmploymentVerification({
        employerOrgId: currentEmployerOrgId,
        contactName,
        contactEmail,
        consentAccepted: true,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setContactName("");
      setContactEmail("");
      setConsentAccepted(false);
      router.refresh();
    });
  }

  function onWithdraw(verificationId: string) {
    setError(null);
    startTransition(async () => {
      const res = await withdrawEmploymentVerification({ verificationId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  // Gate by status. Self-employed seekers can declare their employer
  // (Phase 9.22) but emailing themselves to verify themselves is
  // theatre, so the affordance hides for non-'employed' statuses.
  if (!eligibleStatus(status)) {
    return null;
  }

  // Pending  show the in-flight panel.
  if (current && current.state === "pending") {
    const daysLeft = Math.max(
      0,
      Math.floor(
        (new Date(current.expiresAt).valueOf() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    return (
      <PanelShell>
        <div className="flex items-start gap-3">
          <Clock
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-accent)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h3 className="font-display text-base text-[color:var(--color-ink)]">
              Verification in flight
            </h3>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              We emailed <strong>{current.contactName}</strong> at
              {" "}
              <strong>{current.employerName ?? "the employer"}</strong>.
              They have {daysLeft} day{daysLeft === 1 ? "" : "s"} left to
              respond. We&rsquo;ll notify you with the binary outcome
              (verified or not)  the contact&rsquo;s actual response stays
              between them and the platform.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onWithdraw(current.id)}
                disabled={pending}
              >
                Withdraw request
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-[color:var(--color-danger)]">
                {error}
              </p>
            )}
          </div>
        </div>
      </PanelShell>
    );
  }

  // Resolved + still relevant: show outcome strip. The form to
  // request a new one stays below so the seeker can retry.
  const resolved =
    current && current.state !== "pending" ? current : null;

  return (
    <PanelShell>
      {resolved && (
        <ResolvedStrip current={resolved} />
      )}

      {/* Consent form. Always shown when the seeker is eligible + the
          current employer matches (or there's no resolved record). */}
      <div className="flex items-start gap-3">
        <ShieldCheck
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="font-display text-base text-[color:var(--color-ink)]">
            Verify your employment at{" "}
            {currentEmployerName ?? "your declared employer"}
          </h3>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            One contact, one email. They get a single email with three
            buttons (verify / can&rsquo;t confirm / not their employee).
            Whatever they pick, we delete their email from our records.
            14-day window; you can withdraw any time before they respond.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextField
              id="evp-contact-name"
              label="Contact name"
              placeholder="e.g. Sarah van der Merwe"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={pending}
            />
            <TextField
              id="evp-contact-email"
              label="Contact work email"
              placeholder="e.g. sarah@employer.co.za"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={pending}
            />
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              disabled={pending}
              className="mt-0.5 size-4 cursor-pointer accent-[color:var(--color-ink)]"
            />
            <span className="flex-1 text-sm text-[color:var(--color-ink)]">
              <span className="font-display text-base">I consent</span>
              <span className="mt-1 block text-xs text-[color:var(--color-ink-soft)]">
                I want Sebenza to email this person ONCE to confirm I
                work at{" "}
                <strong>
                  {currentEmployerName ?? "the employer I declared"}
                </strong>
                . They can decline and their email will be deleted from
                our durable records after their response (or within 14
                days if they don&rsquo;t respond). I&rsquo;ve checked
                that this is their work email + I have a real working
                relationship with them.
              </span>
            </span>
          </label>
          {error && (
            <p className="mt-3 text-sm text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onSubmit}
              disabled={
                pending ||
                contactName.trim().length < 2 ||
                contactEmail.trim().length < 4 ||
                !consentAccepted
              }
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {pending ? "Sending" : "Send verification email"}
            </Button>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      {children}
    </section>
  );
}

function ResolvedStrip({ current }: { current: MyVerificationRow }) {
  const config = (() => {
    switch (current.state) {
      case "verified":
        return {
          icon: CheckCircle2,
          tone: "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]",
          iconClass: "text-[color:var(--color-brand-strong)]",
          title: `Verified at ${current.employerName ?? "your employer"}`,
          body: `${current.contactName} confirmed your employment. The Employer-verified badge appears on your public profile until ${new Date(new Date(current.respondedAt ?? current.requestedAt).valueOf() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("en-ZA", { year: "numeric", month: "short" })}.`,
        };
      case "declined":
      case "disputed":
        return {
          icon: AlertCircle,
          tone: "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5",
          iconClass: "text-[color:var(--color-accent)]",
          title: "Verification didn't go through",
          body: `Your contact at ${current.employerName ?? "the employer"} wasn't able to confirm your employment. You can submit a new request with a different contact below.`,
        };
      case "expired":
        return {
          icon: Clock,
          tone: "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]",
          iconClass: "text-[color:var(--color-ink-soft)]",
          title: "Previous verification expired",
          body: `${current.contactName} didn't respond within the 14-day window. Their email was deleted from our records.`,
        };
      case "superseded":
        return {
          icon: ShieldOff,
          tone: "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]",
          iconClass: "text-[color:var(--color-ink-soft)]",
          title: "Previous verification cleared",
          body: "You changed your current employer; the old verification no longer applies.",
        };
      case "withdrawn":
        return {
          icon: ShieldOff,
          tone: "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]",
          iconClass: "text-[color:var(--color-ink-soft)]",
          title: "Previous request withdrawn",
          body: "You withdrew the previous request before the contact responded.",
        };
      default:
        return null;
    }
  })();
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-[var(--radius-sm)] border-2 p-3 ${config.tone}`}
    >
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${config.iconClass}`}
        aria-hidden="true"
      />
      <div className="flex-1 text-sm">
        <p className="font-display text-base text-[color:var(--color-ink)]">
          {config.title}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
          {config.body}
        </p>
        {/* Phase 11.3.6  audit-trail visibility. The seeker sees the
            provenance of their own verification: who confirmed, when,
            and the durable reference number from the
            `employment_verifications.id`. Aligns with POPIA s.23
            (right of access to personal information). */}
        {(current.state === "verified" ||
          current.state === "declined" ||
          current.state === "disputed") && (
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            <span>Audit trail</span>
            <span aria-hidden="true">·</span>
            <span>
              {current.state === "verified"
                ? "Verified"
                : current.state === "declined"
                  ? "Declined"
                  : "Disputed"}{" "}
              by {current.contactName}
            </span>
            {current.respondedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {new Date(current.respondedAt).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono">
              Ref EV-{current.id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
