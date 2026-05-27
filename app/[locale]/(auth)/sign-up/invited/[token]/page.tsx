/**
 * Phase 9.17  invitation-gated sign-up landing.
 *
 * URL: /sign-up/invited/[token]
 *
 * Server-component flow:
 *
 *   1. Verify the token (HMAC + expiry  the signing key check
 *      happens inside `verifyInviteToken`).
 *   2. Load the invite row + the inviting org's display name. The
 *      row must still be in state `pending`  any other state
 *      (accepted/declined/withdrawn/expired) renders the appropriate
 *      end-state copy instead of the form.
 *   3. Pass `invitationContext` into `<SeekerSignUpForm>` so the
 *      name + email + profession pre-fill, the email field locks,
 *      and submit calls `acceptSeekerInvitation` instead of the
 *      public `signUpSeeker`.
 *
 * No auth required to reach this page  the token IS the proof.
 * Brute-forcing the token space is infeasible (HMAC-SHA256 over an
 * opaque uuid).
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { SeekerSignUpForm } from "@/components/feature/auth/SeekerSignUpForm";
import { getProfessions } from "@/lib/taxonomy/query";
import { loadInviteByToken } from "@/lib/employer/seeker-invitations";

export const metadata = { title: "You've been invited to Sebenza" };

export default async function InvitedSignUpPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.seekerSignUp");

  const lookup = await loadInviteByToken(token);
  if (!lookup.ok) {
    return (
      <AuthShell
        eyebrow="Invitation"
        heading="This invitation link is no longer valid"
        subhead={
          lookup.reason === "expired"
            ? "Invitations expire after 14 days. Ask the employer that invited you to send a new one."
            : lookup.reason === "consumed"
              ? "This invitation has already been used. If you've already signed up, just sign in instead."
              : "We couldn't verify this invitation. Ask the employer that invited you to send a fresh link."
        }
        rightAside={<InvitedDossier orgName={null} />}
      >
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
          <p>
            You can still create a Sebenza profile directly  no invitation
            needed.{" "}
            <Link
              href={"/sign-up/seeker" as never}
              className="text-[color:var(--color-brand)] underline hover:text-[color:var(--color-brand-strong)]"
            >
              Create a profile
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  const invite = lookup.invite;
  const professions = await getProfessions();

  return (
    <AuthShell
      eyebrow={`Invited by ${invite.orgName}`}
      heading={t("step1.heading")}
      subhead={`${invite.orgName} has vouched for you. Confirm a few details to create your Sebenza account.`}
      rightAside={<InvitedDossier orgName={invite.orgName} />}
    >
      <SeekerSignUpForm
        professions={professions}
        invitationContext={{
          token,
          orgName: invite.orgName,
          prefilledEmail: invite.email,
          prefilledName: invite.name,
          prefilledProfession: invite.profession,
        }}
      />
    </AuthShell>
  );
}

function InvitedDossier({ orgName }: { orgName: string | null }) {
  const items = [
    {
      n: "01",
      title: orgName ? `Why ${orgName}?` : "Why this invitation?",
      body: orgName
        ? `${orgName} is a verified employer on Sebenza  meaning we've checked their CIPC registration, tax clearance, and proof of address. They thought you'd be a good fit for the platform.`
        : "Sebenza only lets verified employers send invitations  meaning we've checked their CIPC registration, tax clearance, and proof of address before letting them invite anyone.",
    },
    {
      n: "02",
      title: "Your profile, your control",
      body: "Even though they invited you, your profile is yours. You decide what's visible to which employers, you decide which consents to grant, and you can leave at any time.",
    },
    {
      n: "03",
      title: "Just the start",
      body: "After these three steps, your full profile editor lives in the dashboard  experience, qualifications, skills, headline, bio. Add it at your own pace.",
    },
  ];
  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        About this invitation
      </div>
      <ul className="mt-3 space-y-4 text-sm">
        {items.map((item) => (
          <li
            key={item.n}
            className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3"
          >
            <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
              {item.n}
            </span>
            <div>
              <div className="font-display text-base">{item.title}</div>
              <p className="text-[color:var(--color-ink-soft)]">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
