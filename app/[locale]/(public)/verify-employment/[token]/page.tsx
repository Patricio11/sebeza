/**
 * Phase 9.23  public landing for the contact's verify / decline /
 * dispute click from the one-shot email.
 *
 * No authentication required. The token in the URL is the only
 * credential; respondToVerification() validates + idempotent-handles
 * the outcome. Outcomes:
 *
 *   ?outcome=verified   contact confirmed the seeker works there
 *   ?outcome=declined   contact can't confirm
 *   ?outcome=disputed   contact says "I'm not this person's employer"
 *
 * If no outcome param is set (someone hit the bare URL), we render a
 * neutral "what is this?" panel + the three buttons. Same code path
 * either way; the only difference is whether we attempted to record
 * an outcome on first render.
 *
 * Idempotency: a second click on the same email button just shows the
 * "already resolved" state. Tokens are cleared from the durable row
 * after the first non-pending state transition (D4 in the plan).
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { respondToVerification } from "@/lib/profile/employment-verification";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  CheckCircle2,
  AlertCircle,
  ShieldOff,
  Clock,
  HelpCircle,
} from "lucide-react";

type OutcomeParam = "verified" | "declined" | "disputed";

function parseOutcome(raw: string | undefined): OutcomeParam | null {
  if (raw === "verified" || raw === "declined" || raw === "disputed") return raw;
  return null;
}

export default async function VerifyEmploymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const { outcome: outcomeRaw } = await searchParams;
  const outcome = parseOutcome(outcomeRaw);

  // If an outcome is in the query string, record it immediately. The
  // action is idempotent  a repeat click renders the "already
  // resolved" panel without writing anything new.
  let result:
    | Awaited<ReturnType<typeof respondToVerification>>
    | null = null;
  if (outcome) {
    result = await respondToVerification({ token, outcome });
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-12 md:py-20">
        <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          Sebenza · employment verification
        </div>
        {result ? (
          <ResolvedPanel result={result} />
        ) : (
          <UnsolicitedPanel token={token} />
        )}
        <p className="mt-10 text-xs text-[color:var(--color-ink-soft)]">
          POPIA &sect;11: lawful basis for processing your data here is
          performance of an employment-services platform under the seeker&rsquo;s
          recorded consent. Your email is deleted from our records
          immediately on response, or within 14 days of the original request
          if you don&rsquo;t click anything.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function ResolvedPanel({
  result,
}: {
  result: Awaited<ReturnType<typeof respondToVerification>>;
}) {
  if (!result.ok) {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 p-6">
        <h1 className="font-display text-2xl">Link expired or invalid</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          {result.message}
        </p>
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          Verification links expire 14 days after the original email.
          You can safely close this tab.
        </p>
      </div>
    );
  }

  if (result.outcome === "verified") {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-6">
        <CheckCircle2
          className="size-8 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <h1 className="mt-4 font-display text-2xl">
          Thanks for confirming
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink)]">
          You confirmed that <strong>{result.contactName}</strong>{" "}
          identified <strong>{result.orgName}</strong> as their employer.
        </p>
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          Their public profile now carries an Employer-verified badge
          dated this month. Your email has been removed from our durable
          records.
        </p>
      </div>
    );
  }

  if (result.outcome === "declined") {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 p-6">
        <AlertCircle
          className="size-8 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <h1 className="mt-4 font-display text-2xl">Response recorded</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink)]">
          We&rsquo;ve noted that you can&rsquo;t confirm the employment.
          The seeker is informed of the outcome only as &ldquo;not
          verified&rdquo; &mdash; we never share which button you clicked.
        </p>
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          Your email has been removed from our durable records. You won&rsquo;t
          hear from us about this again.
        </p>
      </div>
    );
  }

  if (result.outcome === "disputed") {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 p-6">
        <ShieldOff
          className="size-8 text-[color:var(--color-danger)]"
          aria-hidden="true"
        />
        <h1 className="mt-4 font-display text-2xl">Reported</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink)]">
          Thanks for the heads-up. We&rsquo;ve recorded that you aren&rsquo;t
          this person&rsquo;s employer. Our admin team reviews disputed
          submissions periodically.
        </p>
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          The seeker is informed only of the binary outcome (not
          verified). Your email has been removed from our durable
          records.
        </p>
      </div>
    );
  }

  if (result.outcome === "already_resolved") {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
        <CheckCircle2
          className="size-8 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
        <h1 className="mt-4 font-display text-2xl">Already handled</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          You&rsquo;ve already responded to this request. Nothing more to
          do; you can safely close this tab.
        </p>
      </div>
    );
  }

  // expired
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
      <Clock
        className="size-8 text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <h1 className="mt-4 font-display text-2xl">This request has expired</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
        The 14-day window for this verification has passed. Your email
        was deleted from our durable records.
      </p>
      <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
        If the seeker wants to try again, they can submit a fresh
        request from their dashboard.
      </p>
    </div>
  );
}

function UnsolicitedPanel({ token }: { token: string }) {
  // Bare URL hit  show the three buttons. The links append ?outcome=
  // to the same path; the page above handles the recording.
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
      <HelpCircle
        className="size-8 text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <h1 className="mt-4 font-display text-2xl">Verification request</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink)]">
        Someone on the Sebenza platform asked us to email you to verify
        their employment. If you weren&rsquo;t expecting this, you can
        safely ignore it &mdash; the request will expire within 14 days
        and your email will be deleted from our records.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/verify-employment/${token}?outcome=verified` as never}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-strong)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)]"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Yes, verify
        </Link>
        <Link
          href={`/verify-employment/${token}?outcome=declined` as never}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-2 text-sm text-[color:var(--color-ink)]"
        >
          <AlertCircle className="size-4" aria-hidden="true" />
          I can&rsquo;t confirm
        </Link>
        <Link
          href={`/verify-employment/${token}?outcome=disputed` as never}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 px-4 py-2 text-sm text-[color:var(--color-danger)]"
        >
          <ShieldOff className="size-4" aria-hidden="true" />
          I&rsquo;m not this person&rsquo;s employer
        </Link>
      </div>
    </div>
  );
}
