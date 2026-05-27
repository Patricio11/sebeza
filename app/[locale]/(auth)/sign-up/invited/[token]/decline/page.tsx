/**
 * Phase 9.17  invitation-decline landing.
 *
 * URL: /sign-up/invited/[token]/decline
 *
 * Token-gated; no auth required. The recipient lands here from the
 * "Not interested? Tell us so they don't ask again." link in the
 * invitation email. Submitting flips the row to `declined`,
 * optionally records a 200-char reason, and starts the 90-day
 * per-(org, email) cooldown described in D7.2.
 *
 * No "are you sure" interstitial  the decline path is the gentle
 * one. The destructive variant (Report this invite) lives on a
 * different page.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { Link } from "@/i18n/navigation";
import { loadInviteByToken } from "@/lib/employer/seeker-invitations";
import { DeclineInvitationForm } from "@/components/feature/auth/DeclineInvitationForm";

export const metadata = { title: "Decline invitation" };

export default async function InvitedDeclinePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  await getTranslations("auth.seekerSignUp");

  const lookup = await loadInviteByToken(token);
  if (!lookup.ok) {
    return (
      <AuthShell
        eyebrow="Decline invitation"
        heading={
          lookup.reason === "consumed"
            ? "This invitation was already responded to"
            : "This invitation link is no longer valid"
        }
        subhead={
          lookup.reason === "expired"
            ? "Invitations expire after 14 days. There's nothing to decline."
            : lookup.reason === "consumed"
              ? "It's already been accepted, declined, withdrawn, or expired."
              : "We couldn't verify this invitation."
        }
      >
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
          <p>
            <Link
              href={"/" as never}
              className="text-[color:var(--color-brand)] underline hover:text-[color:var(--color-brand-strong)]"
            >
              Return to Sebenza
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  const invite = lookup.invite;
  return (
    <AuthShell
      eyebrow={`Invited by ${invite.orgName}`}
      heading="Decline this invitation"
      subhead={`We'll let ${invite.orgName} know you're not interested, and we won't allow another invitation from them to this email for at least 90 days.`}
    >
      <DeclineInvitationForm token={token} orgName={invite.orgName} />
    </AuthShell>
  );
}
