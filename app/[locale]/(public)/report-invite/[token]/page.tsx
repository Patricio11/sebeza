/**
 * Phase 9.17  POPIA §16 transparency: token-gated report-invite
 * landing.
 *
 * Reached from the "Report this invite" link in every Sebenza
 * invitation email. No auth required  the token is the proof of
 * identity for the report. Submitting fires an `all_admins`
 * notification + a `org.seeker_invite.reported` audit row; the
 * invitation itself is NOT auto-withdrawn (admins review).
 *
 * If the token has expired or been revoked we still show a calm
 * "no longer valid" message rather than redirecting  the recipient
 * came to flag concern, so we acknowledge that even if the underlying
 * row is gone.
 */

import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Link } from "@/i18n/navigation";
import { loadInviteByToken } from "@/lib/employer/seeker-invitations";
import { ReportInviteForm } from "@/components/feature/legal/ReportInviteForm";

export const metadata = { title: "Report an invitation" };

export default async function ReportInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const lookup = await loadInviteByToken(token);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[640px] px-5 py-12 md:py-20">
        <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
          Report an invitation
        </p>
        <h1 className="mt-2 font-display text-4xl text-[color:var(--color-ink)] md:text-5xl">
          Tell us what&rsquo;s wrong
        </h1>
        <p className="mt-4 text-base text-[color:var(--color-ink-soft)]">
          A Sebenza administrator will review the report. We may suspend
          the inviting organisation&rsquo;s account if it looks like email
          harvesting or other abuse.
        </p>

        <div className="mt-8">
          {lookup.ok ? (
            <ReportInviteForm token={token} orgName={lookup.invite.orgName} />
          ) : (
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
              <p>
                We couldn&rsquo;t verify the invitation link  it may have
                expired or already been handled. If you keep receiving
                invitations from someone you don&rsquo;t know, email
                support@sebenzasa.com directly.
              </p>
              <p className="mt-3">
                <Link
                  href={"/" as never}
                  className="text-[color:var(--color-brand)] underline hover:text-[color:var(--color-brand-strong)]"
                >
                  Return to Sebenza
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
