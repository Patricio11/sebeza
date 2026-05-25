/**
 * Phase 9.10  Employer onboarding / KYC verification surface.
 *
 * Single URL, five status-aware sub-views (driven by the org's
 * verification column + the Owner's emailVerified flag):
 *
 *   1. emailVerified=false                "Verify your email"
 *                                          + resend button
 *   2. unverified + emailVerified         OrgOnboardingForm (with
 *                                          yellow admin-note banner
 *                                          when adminNote is set
 *                                          the resubmission case)
 *   3. pending                            "Application under review"
 *                                          no actions
 *   4. verified                            "You're verified" + auto-
 *                                          redirect to /employer (2s)
 *   5. rejected                            Red callout with the
 *                                          rejection reason
 *
 * Owner-only edit. Recruiter / Viewer members of an org land here
 * read-only with a copy nudge to ask their Owner to sign in.
 *
 * Lives at `/employer/onboarding` (NOT under the future
 * `(verified)` route group from 9.10.3)  this is the surface
 * unverified orgs need to reach.
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import {
  EMPLOYER_NAV,
  MOCK_EMPLOYER,
} from "@/components/layout/employerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyOrgVettingState } from "@/lib/employer/vetting";
import { OrgOnboardingForm } from "@/components/feature/employer/OrgOnboardingForm";
import { resendVerificationEmail } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Mail,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export const revalidate = 0;

export default async function EmployerOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyRole("employer");

  const state = await getMyOrgVettingState();

  // Defensive: an employer with no org row shouldn't exist post-signup,
  // but if it happens (manual DB poking), bounce to account so they
  // can see what's going on.
  if (!state) {
    return (
      <Shell title="Verification">
        <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-danger)] bg-[color:var(--color-surface)] p-6">
          <h2 className="font-display text-xl text-[color:var(--color-ink)]">
            Your account isn&rsquo;t linked to an organisation
          </h2>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            Contact support to resolve  this is unusual and we can fix it
            from the admin side.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Branch (1)  email not verified yet ──────────────────────────────
  if (!state.emailVerified) {
    return (
      <Shell title="Verify your email">
        <section
          aria-labelledby="email-verify-h"
          className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-brand-tint)] p-6"
        >
          <div className="flex items-start gap-3">
            <Mail
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
              aria-hidden="true"
            />
            <div>
              <h2
                id="email-verify-h"
                className="font-display text-xl text-[color:var(--color-ink)]"
              >
                We need to confirm your email first
              </h2>
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                Open the verification email we sent to{" "}
                <strong>{session.email ?? "your inbox"}</strong> and click the
                link. After that you&rsquo;ll land back here to upload your
                KYC documents.
              </p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              if (session.email) await resendVerificationEmail(session.email);
            }}
            className="mt-5"
          >
            <Button type="submit" variant="secondary" size="md">
              Resend verification email
            </Button>
          </form>
          <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
            Check your spam / junk folder if it&rsquo;s been more than a few
            minutes. Outlook + Gmail sometimes file first-time senders
            there. If you&rsquo;ve lost the email entirely, support can
            mark you verified manually  reach out via your sign-up email.
          </p>
        </section>
      </Shell>
    );
  }

  // ── Branch (3)  pending review ─────────────────────────────────────
  if (state.verification === "pending") {
    return (
      <Shell title="Under review">
        <section
          aria-labelledby="pending-h"
          className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-6 md:p-8"
        >
          <div className="flex items-start gap-3">
            <Clock
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
              aria-hidden="true"
            />
            <div>
              <h2
                id="pending-h"
                className="font-display text-xl text-[color:var(--color-ink)]"
              >
                Thanks  your application is under review
              </h2>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                Our team typically reviews KYC submissions within one
                business day. You&rsquo;ll get an email + an in-app
                notification when there&rsquo;s a decision.
              </p>
              <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
                You can keep browsing the public talent base while we review,
                but candidate-reveal and document-download features stay
                locked until your organisation is verified.
              </p>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  // ── Branch (4)  verified ───────────────────────────────────────────
  if (state.verification === "verified") {
    // Auto-redirect to the dashboard. Server-side redirect so it
    // happens before the page even renders  no flashy "wait 2s"
    // intermediate state for already-verified orgs.
    redirect("/employer");
  }

  // ── Branch (5)  rejected ───────────────────────────────────────────
  if (state.verification === "rejected") {
    return (
      <Shell title="Application not approved">
        <section
          aria-labelledby="rejected-h"
          className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-danger)] bg-[color:var(--color-surface)] p-6 md:p-8"
        >
          <div className="flex items-start gap-3">
            <XCircle
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-danger)]"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h2
                id="rejected-h"
                className="font-display text-xl text-[color:var(--color-ink)]"
              >
                Your verification was not approved
              </h2>
              {state.rejectionReason ? (
                <div className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 p-3 text-sm text-[color:var(--color-ink)]">
                  <p className="font-medium">Reason from our team:</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {state.rejectionReason}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                  No specific reason was recorded. Reach out to support and
                  we&rsquo;ll walk through it with you.
                </p>
              )}
              <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
                If circumstances have changed, contact support  rejected
                applications can be re-vetted after the underlying issue is
                resolved.
              </p>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  // ── Branch (2)  unverified + ready to submit (or resubmit) ────────
  // Owner-only edit path; non-Owners see a read-only nudge.
  if (!state.isOwner) {
    return (
      <Shell title="Verification">
        <section className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-6">
          <div className="flex items-start gap-3">
            <Lock
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-ink-soft)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-display text-xl text-[color:var(--color-ink)]">
                Your organisation needs KYC verification
              </h2>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                Only the organisation Owner can submit the verification
                documents. Ask the Owner of <strong>{state.orgName}</strong>{" "}
                to sign in and complete onboarding.
              </p>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  return (
    <Shell title={state.adminNote ? "Update your application" : "Complete your verification"}>
      {state.adminNote && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] border-2 border-[color:var(--color-warn,#b08600)] bg-[color:var(--color-warn,#b08600)]/10 p-4"
        >
          <AlertCircle
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-warn,#b08600)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-display text-base text-[color:var(--color-ink)]">
              Our team asked you to revise this
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--color-ink-soft)]">
              {state.adminNote}
            </p>
            <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
              Edit the details below + resubmit. We&rsquo;ll clear this note
              once you submit again.
            </p>
          </div>
        </div>
      )}

      <section
        aria-labelledby="onboarding-h"
        className="mb-6 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-brand-tint)] p-5 md:p-6"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <h2
              id="onboarding-h"
              className="font-display text-xl text-[color:var(--color-ink)]"
            >
              KYC verification for {state.orgName}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              Upload the four SA-standard documents below + your physical
              address. We review submissions within one business day.
              Until you&rsquo;re verified you can browse the public talent
              base, but candidate-reveal + document-download features stay
              locked.
            </p>
          </div>
        </div>
      </section>

      <OrgOnboardingForm
        initial={{
          companyAddress: state.companyAddress,
          vatNumber: state.vatNumber,
          city: state.city,
          documents: state.documents,
          adminNote: state.adminNote,
        }}
      />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell helper  keeps the page sub-views consistent without duplicating
// every prop on DashboardShell.
// ─────────────────────────────────────────────────────────────────────────────

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="organisation"
      pageEyebrow="Verification"
      pageTitle={title}
      pageSubtitle="Your organisation needs to clear KYC before you can reveal seeker contact details, download documents, or send vacancy invites."
    >
      {children}
      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        Need help?{" "}
        <Link href="/privacy" className="underline">
          See how we handle your documents
        </Link>{" "}
         everything you upload is server-side stored, audit-logged, and
        visible only to the Sebenza admin team during review.
      </p>
    </DashboardShell>
  );
}
